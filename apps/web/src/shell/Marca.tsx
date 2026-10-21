import s from "./Shell.module.css";

/** Marca do ITO 2.0: "I" em âmbar + "ITO" em Geist Mono espaçada. */
export function Marca() {
  return (
    <div className={s.marca}>
      <div className={s.marcaSelo} aria-hidden="true">
        I
      </div>
      <span className={s.marcaPalavra}>ITO</span>
    </div>
  );
}
