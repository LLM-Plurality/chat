import type { Timestamps } from "./Timestamps";
import type { ObjectId } from "mongodb";

export interface UserToken extends Timestamps {
	_id: ObjectId;
	userId: ObjectId;
	encryptedToken: string;
	provider: "huggingface";
}
