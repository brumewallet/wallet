import "@hazae41/symbol-dispose-polyfill"

import "@/styles/index.css"

import { Console } from "@/libs/console"
import { Errors } from "@/libs/errors/errors"
import { isSafariExtension } from "@/libs/platform/platform"
import { useAsyncUniqueCallback } from "@/libs/react/callback"
import { Catcher, PromiseCatcher } from "@/libs/react/error"
import { ErrorProps } from "@/libs/react/props/error"
import { GlobalPageHeader, PageBody } from "@/libs/ui2/page/header"
import { Page } from "@/libs/ui2/page/page"
import { BackgroundProvider } from "@/mods/foreground/background/context"
import { WideShrinkableContrastButton, WideShrinkableOppositeButton } from "@/mods/foreground/entities/wallets/actions/send"
import { HashPathProvider } from "@/mods/foreground/router/path/context"
import { GlobalStorageProvider } from "@/mods/foreground/storage/global"
import { UserStorageProvider } from "@/mods/foreground/storage/user"
import { Base16 } from "@hazae41/base16"
import { Base58 } from "@hazae41/base58"
import { Base64 } from "@hazae41/base64"
import { Base64Url } from "@hazae41/base64url"
import { ChaCha20Poly1305 } from "@hazae41/chacha20poly1305"
import { Ed25519 } from "@hazae41/ed25519"
import { Keccak256 } from "@hazae41/keccak256"
import { Ripemd160 } from "@hazae41/ripemd160"
import { Secp256k1 } from "@hazae41/secp256k1"
import { Sha1 } from "@hazae41/sha1"
import { X25519 } from "@hazae41/x25519"
import type { AppProps } from 'next/app'
import Head from "next/head"
import { useCallback, useEffect, useMemo } from "react"

export function Fallback(props: ErrorProps) {
  const { error } = props

  const reload = useCallback(() => {
    location.reload()
  }, [])

  const reset = useAsyncUniqueCallback(() => Errors.runAndLogAndAlert(async () => {
    if (!isSafariExtension() && confirm(`You will lose all your wallets if you didn't made backups, are you sure?`) === false)
      return

    const databases = await indexedDB.databases()

    for (const database of databases)
      if (database.name)
        indexedDB.deleteDatabase(database.name)

    localStorage.clear()
    location.reload()
  }), [])

  return <Page>
    <GlobalPageHeader title="Error" />
    <PageBody>
      <div className="text-red-400 dark:text-red-500">
        An unexpected error occured
      </div>
      <div className="text-contrast">
        {Errors.toString(error)}
      </div>
      <div className="h-4 grow" />
      <div className="flex items-center flex-wrap-reverse gap-2">
        <WideShrinkableContrastButton
          onClick={reset.run}>
          Clear everything and reload the page
        </WideShrinkableContrastButton>
        <WideShrinkableOppositeButton
          onClick={reload}>
          Reload the page
        </WideShrinkableOppositeButton>
      </div>
    </PageBody>
  </Page>
}

async function initBerith() {
  Ed25519.set(await Ed25519.fromSafeOrNoble())
  X25519.set(await X25519.fromNativeOrNoble())
}

async function initEligos() {
  Secp256k1.set(Secp256k1.fromNoble())
}

async function initMorax() {
  Keccak256.set(Keccak256.fromNoble())
  Sha1.set(await Sha1.fromNoble())
  Ripemd160.set(Ripemd160.fromNoble())
}

async function initAlocer() {
  Base16.set(await Base16.fromBufferOrScure())
  Base64.set(await Base64.fromBufferOrScure())
  Base64Url.set(await Base64Url.fromBufferOrScure())
  Base58.set(await Base58.fromScure())
}

async function initZepar() {
  ChaCha20Poly1305.set(await ChaCha20Poly1305.fromNoble())
}

export function Initializer(props: {}) {
  useEffect(() => {
    const gt = globalThis as any
    gt.Console = Console

    initBerith()
    initEligos()
    initMorax()
    initAlocer()
    initZepar()
  }, [])

  return null
}

export default function App({ Component, pageProps }: AppProps) {
  const goto = useMemo(() => {
    if ("location" in globalThis === false)
      return

    const url = new URL(location.href)
    const goto = url.searchParams.get("_")

    if (!goto)
      return

    url.hash = decodeURIComponent(goto)
    url.search = ""

    location.replace(url)
    return goto
  }, [])

  if (goto != null)
    return null

  return <>
    <Head>
      <title>Brume Wallet</title>
      <meta key="viewport" name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
    </Head>
    <Catcher fallback={Fallback}>
      <PromiseCatcher>
        <Initializer />
        <HashPathProvider>
          <BackgroundProvider>
            <GlobalStorageProvider>
              <UserStorageProvider>
                <Component {...pageProps} />
              </UserStorageProvider>
            </GlobalStorageProvider>
          </BackgroundProvider>
        </HashPathProvider>
      </PromiseCatcher>
    </Catcher>
  </>
}
