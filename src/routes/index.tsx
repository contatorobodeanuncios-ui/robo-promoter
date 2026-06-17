import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    // A primeira coisa que aparece é SEMPRE a abertura.
    throw redirect({ to: "/power-on" });
  },
  component: () => null,
});
