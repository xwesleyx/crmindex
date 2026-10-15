import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname.startsWith("/login");

  if (!isLoggedIn && !isLoginPage) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  // "fonts" e "images" ficam de fora: a tela de login (INDEX) carrega
  // /fonts/alex-brush.ttf e /images/login-scene.jpg ainda deslogado — sem
  // essa exceção o proxy redirecionava os dois pra /login (o segundo quebra
  // em silêncio: o otimizador de imagem do Next busca o arquivo internamente
  // e recebe o HTML de /login no lugar, "not a valid image").
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|fonts|images).*)"],
};
