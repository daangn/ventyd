export function clientLoader() {
  return new Response(null, { status: 302, headers: { Location: "/docs" } });
}

export default function Home() {
  return <div />;
}
