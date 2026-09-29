import RustaBase from "rustabase";

const rb = new RustaBase("http://127.0.0.1:8090");
await rb.auth("_superusers").signInWithPassword("admin@example.com", "password");

const stats = await rb.admin.webhooks.stats();
for (const hook of await rb.admin.webhooks.list()) {
    const s = stats[hook.id];
    if (s?.error) {
        const failed = await rb.admin.webhooks.deliveries(hook.id, { status: "error", limit: 10 });
        console.log(hook.id, failed.map((d) => d.error));
    }
}
