import { SignJWT } from "jose";
export const signb = (k: Uint8Array) => new SignJWT({}).sign(k);
