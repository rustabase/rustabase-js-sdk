import { createClient } from "rustabase";
export const rb = createClient(process.env.RUSTABASE_URL ?? "", { timeout: 10_000, retry: { attempts: 3, delay: 250 } });
