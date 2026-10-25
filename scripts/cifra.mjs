// Cifragem dos backups do ITO (M13 · S08): AES-256-GCM com chave derivada (scrypt) de uma frase
// guardada fora do backup (ITO_BACKUP_CHAVE: no ambiente ou em .env.supabase.local; o lugar certo
// é o cofre de senhas da empresa). Sem a frase, o arquivo não abre; adulterado, não abre também.
//
// Formato: "ITOBK1" · sal (16) · iv (12) · dados cifrados · etiqueta GCM (16).
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { createReadStream, createWriteStream, readFileSync } from "node:fs";
import { pipeline } from "node:stream/promises";

const MAGICO = Buffer.from("ITOBK1");
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export const EXTENSAO = ".cifrado";

const chaveDe = (frase, sal) => scryptSync(frase, sal, 32, SCRYPT);

export function exigirFrase(frase) {
  if (!frase || frase.length < 16)
    throw new Error(
      "Defina ITO_BACKUP_CHAVE com ao menos 16 caracteres (guarde a frase no cofre, não junto do backup).",
    );
  return frase;
}

/** Cifra `origem` em `destino` (em fluxo: o arquivo não precisa caber na memória). */
export async function cifrarArquivo(origem, destino, frase) {
  const sal = randomBytes(16);
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chaveDe(exigirFrase(frase), sal), iv);
  await pipeline(
    createReadStream(origem),
    c,
    async function* (cifrado) {
      yield Buffer.concat([MAGICO, sal, iv]);
      for await (const bloco of cifrado) yield bloco;
      yield c.getAuthTag();
    },
    createWriteStream(destino, { mode: 0o600 }),
  );
}

/** Decifra um arquivo inteiro; erro claro com a frase errada ou o arquivo adulterado. */
export function decifrarArquivo(arquivo, frase) {
  const b = readFileSync(arquivo);
  if (b.length < 50 || !b.subarray(0, 6).equals(MAGICO))
    throw new Error(`${arquivo} não é um backup cifrado do ITO.`);
  const sal = b.subarray(6, 22);
  const iv = b.subarray(22, 34);
  const d = createDecipheriv("aes-256-gcm", chaveDe(exigirFrase(frase), sal), iv);
  d.setAuthTag(b.subarray(b.length - 16));
  try {
    return Buffer.concat([d.update(b.subarray(34, b.length - 16)), d.final()]);
  } catch {
    throw new Error("Frase errada ou arquivo do backup alterado: o backup não foi aberto.");
  }
}
