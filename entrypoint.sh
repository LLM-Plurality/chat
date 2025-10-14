ENV_LOCAL_PATH=/app/.env.local

if test -z "${DOTENV_LOCAL}" ; then
    if ! test -f "${ENV_LOCAL_PATH}" ; then
        echo "DOTENV_LOCAL was not found in the ENV variables and .env.local is not set using a bind volume. Make sure to set environment variables properly. "
    fi;
else
    echo "DOTENV_LOCAL was found in the ENV variables. Creating .env.local file."
    cat <<< "$DOTENV_LOCAL" > ${ENV_LOCAL_PATH}
fi;

if [ "$INCLUDE_DB" = "true" ] ; then
    echo "Starting local MongoDB instance"
    nohup mongod &
fi;

# Start Ollama service for HF space (local gpu)
echo "Starting local Ollama service"
nohup ollama serve > /tmp/ollama.log 2>&1 &
OLLAMA_PID=$!

# Wait for Ollama to be ready
MAX_RETRIES=30
RETRY_COUNT=0
until curl -s http://localhost:11434/api/tags > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "Ollama failed to start after $MAX_RETRIES attempts"
        cat /tmp/ollama.log
        exit 1
    fi
    sleep 2
done

# Pull models, ex.: OLLAMA_MODELS="llama3.1:8b,mistral:7b,codellama:13b"
OLLAMA_MODELS=${OLLAMA_MODELS:-llama3.1:8b}

IFS=',' read -ra MODEL_ARRAY <<< "$OLLAMA_MODELS"
for MODEL in "${MODEL_ARRAY[@]}"; do
    MODEL=$(echo "$MODEL" | xargs) # trim whitespace
    if ! ollama list | grep -q "$MODEL"; then
        echo "  Pulling model: $MODEL (this may take several minutes)..."
        ollama pull "$MODEL"
        echo "  $MODEL pulled successfully!"
    else
        echo "  $MODEL already exists"
    fi
done

export PUBLIC_VERSION=$(node -p "require('./package.json').version")

dotenv -e /app/.env -c -- node /app/build/index.js -- --host 0.0.0.0 --port 3000