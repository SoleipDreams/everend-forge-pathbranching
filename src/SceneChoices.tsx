import amber from "./assets/scenes/amber.jpg";
import violet from "./assets/scenes/violet.jpg";
import jade from "./assets/scenes/jade.jpg";
import copper from "./assets/scenes/copper.jpg";
import { normalizeBackgroundScene } from "./backgroundScenes";
import "./sceneChoices.css";

const choices = [
  { id: "original", es: "Original", en: "Original", image: undefined },
  { id: "amber", es: "Ámbar y azul", en: "Amber and blue", image: amber },
  { id: "violet", es: "Violeta", en: "Violet", image: violet },
  { id: "jade", es: "Jade", en: "Jade", image: jade },
  { id: "copper", es: "Cobre", en: "Copper", image: copper },
];
export function SceneChoices({ scene, locale, onScene }: {
  scene?: string; locale: "en" | "es"; onScene: (scene: string) => void;
}) {
  const es = locale === "es";
  const selected = normalizeBackgroundScene(scene);
  return <section className="ef-scene-choices" aria-label={es ? "Imagen de fondo" : "Background image"}>
    <h3>{es ? "Imagen de fondo" : "Background image"}</h3>
    <div className="ef-scene-grid">{choices.map(choice => <button
      type="button" key={choice.id} aria-pressed={choice.id === selected}
      aria-label={es ? choice.es : choice.en} onClick={() => onScene(choice.id)}
      className="ef-scene-choice">
      {choice.image ? <img src={choice.image} alt="" /> : <span className="ef-scene-original" />}
      <span className="ef-scene-name">{es ? choice.es : choice.en}<span aria-hidden="true">{choice.id === selected ? "✓" : ""}</span></span>
    </button>)}</div>
    <p>{es ? "Fondos originales generados para Forge. Tu elección se guarda en este dispositivo." : "Original backgrounds generated for Forge. Your choice is saved on this device."}</p>
  </section>;
}
