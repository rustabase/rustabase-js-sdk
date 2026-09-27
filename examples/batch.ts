import { createClient } from "rustabase";
const rb=createClient("https://app.example.com");
export async function publish(){const batch=rb.batch();batch.from("posts").create({title:"Ready"});batch.from("audit").create({action:"publish"});return batch.send()}
