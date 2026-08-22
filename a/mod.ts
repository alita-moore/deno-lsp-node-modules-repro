import { SignJWT } from "jose";
export const signa = (k: Uint8Array) => new SignJWT({}).sign(k);
