import { base } from "$app/paths";
import { redirect } from "@sveltejs/kit";

export async function load({ parent }) {
	const data = await parent();
	const active = data.settings?.activePersona;
	const first = data.settings?.personas?.[0]?.id;
	if (active) {
		redirect(302, `${base}/settings/personas/${active}`);
	}
	if (first) {
		redirect(302, `${base}/settings/personas/${first}`);
	}
	redirect(302, `${base}/settings`);
}
