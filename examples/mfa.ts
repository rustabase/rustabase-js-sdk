import { RustaBaseError, createClient } from "rustabase";
const rb=createClient("https://app.example.com");
export async function signIn(email:string,password:string,code:string){try{return await rb.auth().signInWithPassword(email,password)}catch(error){if(error instanceof RustaBaseError&&error.mfaId){const {otpId}=await rb.auth().requestOtp(email);return rb.auth().signInWithOtp(otpId,code,{mfaId:error.mfaId})}throw error}}
