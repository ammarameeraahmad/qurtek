import { customAlphabet } from "nanoid";

const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const SHOHIBUL_TOKEN_LENGTH = 10;
const generate = customAlphabet(alphabet, SHOHIBUL_TOKEN_LENGTH);

export function generateShohibulToken() {
  return generate();
}
