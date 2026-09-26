import { createFileRoute } from "@tanstack/react-router";

import { Odontogram3D } from "@/components/odontogram/Odontogram3D";

export const Route = createFileRoute("/")({
  ssr: false, // the WebGL canvas must never render on the server
  head: () => ({
    meta: [
      { title: "Odontograma 3D — Arcadas completas interactivas" },
      {
        name: "description",
        content:
          "Odontograma 3D interactivo con 32 dientes independientes, numeración FDI, estados clínicos y controles de cámara.",
      },
      { property: "og:title", content: "Odontograma 3D interactivo" },
      {
        property: "og:description",
        content:
          "Escena 3D real de la cavidad oral: 32 piezas seleccionables, numeración FDI y registro de estados.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="h-screen w-screen">
      <Odontogram3D
        onChange={(fdi, state) => {
          // Punto de integración con el odontograma existente
          console.log("[odontograma] pieza", fdi, "->", state);
        }}
      />
    </main>
  );
}
