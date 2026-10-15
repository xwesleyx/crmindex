"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { parse, type Font, type PathCommand } from "opentype.js";
import { cn } from "cn";

const FONT_URL = "/fonts/alex-brush.ttf";
const REFERENCE_SIZE = 100;

// path.toPathData() do opentype.js tem um bug de arredondamento que produz
// "NaN" no meio da string em certas curvas (reproduzido com "Gabriel" — a
// maiúscula decorativa some sozinha do resto do nome; o navegador rejeita o
// `d` inteiro a partir do primeiro NaN, cortando todas as letras depois
// dele). path.commands (o array bruto, sem essa serialização) não tem esse
// problema — serializa a mão aqui em vez de usar o helper da lib.
function commandsToPathData(commands: PathCommand[], decimals: number): string {
  const n = (v: number) => v.toFixed(decimals);
  return commands
    .map((c) => {
      switch (c.type) {
        case "M":
          return `M${n(c.x)} ${n(c.y)}`;
        case "L":
          return `L${n(c.x)} ${n(c.y)}`;
        case "C":
          return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`;
        case "Q":
          return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`;
        case "Z":
          return "Z";
      }
    })
    .join("");
}

// Foto de fundo (public/images/login-scene.jpg) — dimensões reais, também
// usadas como viewBox do SVG por cima dela (ver comentário mais abaixo sobre
// por que isso mantém as duas camadas alinhadas em qualquer tamanho de tela).
const IMAGE_W = 1774;
const IMAGE_H = 887;

// Linha de base da assinatura, calibrada em cima de um print real marcado
// pelo usuário (linha vermelha sobre a foto): começa perto do "Olá," e sobe
// levemente até a ponta da caneta parada — por isso o ângulo, não é uma
// caixa reta. START/END viram origem+rotação do path (não um
// bounding-box centralizado), pra a assinatura nascer exatamente na
// inclinação dessa linha.
const BASELINE_START = { x: 1070, y: 628 };
const BASELINE_END = { x: 1465, y: 575 };
const BASELINE_DX = BASELINE_END.x - BASELINE_START.x;
const BASELINE_DY = BASELINE_END.y - BASELINE_START.y;
const BASELINE_ANGLE_DEG = (Math.atan2(BASELINE_DY, BASELINE_DX) * 180) / Math.PI;
const BASELINE_LENGTH = Math.hypot(BASELINE_DX, BASELINE_DY);

// Curva "ease" padrão do CSS, escrita como spline pro SMIL entender (ele não
// aceita a palavra-chave "ease").
const WRITING_EASE_SPLINE = "0.25 0.1 0.25 1";

// opentype.js 2.x removeu load()/loadSync() (viram stubs deprecated que só
// logam e retornam undefined) — a forma atual é buscar o arquivo e chamar
// parse() no buffer. https://github.com/opentypejs/opentype.js/issues/675
let fontPromise: Promise<Font> | null = null;
function loadSignatureFont() {
  if (!fontPromise) {
    fontPromise = fetch(FONT_URL)
      .then((res) => res.arrayBuffer())
      .then((buffer) => parse(buffer));
  }
  return fontPromise;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const listener = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);
  return reduced;
}

type BookPanelProps = {
  /** Nome sendo assinado. null/undefined = cena parada, aguardando login. */
  signingName?: string | null;
  /** Chamado quando a cena termina (sempre disparado por timer, não depende de o elemento estar visível). */
  onDone?: () => void;
  /**
   * Precisa incluir uma posição não-static (ex: "fixed inset-0") — o
   * componente não define uma própria pra não conflitar com ela; a foto de
   * fundo usa next/image com `fill`, que exige um ancestral posicionado.
   */
  className: string;
};

// Fundo em tela cheia: a foto da cena de escritório (documento, caneta
// parada, planta, notebook) com o nome de quem logou sendo "escrito" à mão
// por cima — o path SVG vem do contorno real das letras (opentype.js),
// preenchido (tinta sólida, não só contorno) e revelado progressivamente da
// esquerda pra direita por um recorte que cresce, acompanhando a inclinação
// da linha de assinatura.
//
// Por quê um recorte crescendo, e não stroke-dashoffset (que é a técnica
// mais comum pra "desenhar" um path): nomes com maiúscula decorativa (ex:
// "Gabriel", "Jheniffer") viram, na fonte cursiva, vários subtraçados
// desconectados (a maiúscula é um floreio separado do resto da palavra) — o
// truque de stroke-dasharray/dashoffset com pathLength=1 não revela esses
// pedaços de forma confiável nesse caso, só a primeira letra ficava visível.
// Um recorte retangular que cresce não depende de quantos pedaços o path
// tem, então funciona igual pra qualquer nome.
//
// A foto usa object-fit "cover" com object-position "right" (nunca
// estica/deforma, só recorta a partir da esquerda conforme a proporção da
// tela) e o SVG por cima usa viewBox com as mesmas dimensões da foto +
// preserveAspectRatio="xMaxYMid slice" — o equivalente em SVG desse mesmo
// "cover ancorado à direita" — então as duas camadas cortam exatamente do
// mesmo jeito em qualquer tamanho de tela. Ancorado à direita (não
// centralizado) de propósito: a área vazia da esquerda já fica coberta pelo
// card do formulário mesmo, então pode cortar dali; documento/caneta/
// assinatura (à direita) é o que precisa continuar visível sempre.
export function BookPanel({ signingName, onDone, className }: BookPanelProps) {
  const reactId = useId();
  const clipId = `signature-clip-${reactId}`;
  const [pathData, setPathData] = useState<string | null>(null);
  const [transform, setTransform] = useState("");
  const [revealBox, setRevealBox] = useState({ x: 0, y: 0, height: 0, width: 0 });
  const [failed, setFailed] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!signingName) return;

    let cancelled = false;
    const displayName = signingName.trim() || "Bem-vindo";

    loadSignatureFont()
      .then((font) => {
        if (cancelled) return;
        const path = font.getPath(displayName, 0, 0, REFERENCE_SIZE);
        const box = path.getBoundingBox();
        // Largura de avanço (não a bounding box) pra caber no comprimento da
        // linha de verdade — a bounding box de uma cursiva varia muito com
        // floreios de letra em letra e deixaria nomes curtos ou compridos
        // com escalas inconsistentes.
        const naturalWidth = font.getAdvanceWidth(displayName, REFERENCE_SIZE) || 1;
        const scale = Math.min(BASELINE_LENGTH / naturalWidth, 1.5);

        // origem no início da linha, gira pro ângulo dela, depois escala —
        // o path do opentype já nasce com a base em y=0 e começa em x=0,
        // então isso planta a assinatura exatamente sobre a linha de base.
        setTransform(
          `translate(${BASELINE_START.x} ${BASELINE_START.y}) rotate(${BASELINE_ANGLE_DEG.toFixed(2)}) scale(${scale.toFixed(4)})`
        );
        setPathData(commandsToPathData(path.commands, 2));

        // Caixa do recorte: cobre toda a altura das letras (ascendentes +
        // descendentes) com uma margem, e a largura total do avanço (com
        // folga pra floreios que ultrapassem o avanço natural).
        const margin = 30;
        setRevealBox({
          x: box.x1 - margin,
          y: box.y1 - margin,
          width: Math.max(box.x2 - box.x1, naturalWidth) + margin * 2,
          height: box.y2 - box.y1 + margin * 2,
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [signingName]);

  // Timer é a única fonte de verdade pra avançar o login — não depende de
  // animationend (que nunca dispara se o painel estiver "hidden sm:block" no
  // celular) nem de o SMIL terminar de verdade.
  const chars = (signingName?.trim() || "Bem-vindo").length;
  const duration = Math.min(Math.max(chars * 0.24, 2.8), 5.5);

  useEffect(() => {
    if (!signingName) return;
    if (failed) {
      const t = setTimeout(() => onDoneRef.current?.(), 300);
      return () => clearTimeout(t);
    }
    if (!pathData) return;

    const delayMs = reducedMotion ? 350 : duration * 1000;
    const t = setTimeout(() => onDoneRef.current?.(), delayMs);
    return () => clearTimeout(t);
  }, [signingName, pathData, failed, reducedMotion, duration]);

  const isSigning = !!(signingName && pathData);

  // O <animate> só entra no DOM quando a assinatura começa (render
  // condicional), e SMIL com begin implícito ("0s") conta o tempo a partir
  // de quando o documento SVG carregou — não de quando esse elemento
  // específico foi inserido. Pra um elemento inserido bem depois disso, o
  // navegador entende que o "0s" já passou há muito tempo e trava direto no
  // estado final (fill="freeze"), sem transição nenhuma — exatamente o "a
  // assinatura só aparece pronta, sem animação de escrita" relatado. Por
  // isso begin="indefinite" na animação e o disparo manual aqui, no exato
  // momento em que ela é inserida.
  const animateRef = useRef<SVGAnimateElement>(null);
  useEffect(() => {
    if (isSigning && !reducedMotion) {
      animateRef.current?.beginElement();
    }
  }, [isSigning, reducedMotion]);

  return (
    <div className={cn("overflow-hidden", className)}>
      <Image
        src="/images/login-scene.jpg"
        alt=""
        aria-hidden
        priority
        fill
        sizes="100vw"
        className="pointer-events-none object-cover object-right select-none"
      />

      <svg
        viewBox={`0 0 ${IMAGE_W} ${IMAGE_H}`}
        preserveAspectRatio="xMaxYMid slice"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
      >
        {isSigning && (
          <g transform={transform}>
            <defs>
              <clipPath id={clipId}>
                <rect x={revealBox.x} y={revealBox.y} height={revealBox.height} width={reducedMotion ? revealBox.width : 0}>
                  {!reducedMotion && (
                    <animate
                      ref={animateRef}
                      attributeName="width"
                      from={0}
                      to={revealBox.width}
                      dur={`${duration}s`}
                      begin="indefinite"
                      fill="freeze"
                      calcMode="spline"
                      keyTimes="0;1"
                      keySplines={WRITING_EASE_SPLINE}
                    />
                  )}
                </rect>
              </clipPath>
            </defs>
            <path d={pathData ?? undefined} fill="var(--primary)" stroke="none" clipPath={`url(#${clipId})`} />
          </g>
        )}
      </svg>
    </div>
  );
}
