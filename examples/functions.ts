import RustaBase from "rustabase";

const rb = new RustaBase("http://127.0.0.1:8090");

const out = await rb.admin.functions.invoke("hello", {
    method: "GET",
    query: { name: "RustaBase" },
});
console.log(out);
