import { Color } from "@/libs/colors/colors";
import { Errors } from "@/libs/errors/errors";
import { Outline } from "@/libs/icons/icons";
import { useModhash } from "@/libs/modhash/modhash";
import { isSafariExtension } from "@/libs/platform/platform";
import { useAsyncUniqueCallback } from "@/libs/react/callback";
import { useInputChange, useTextAreaChange } from "@/libs/react/events";
import { useAsyncReplaceMemo } from "@/libs/react/memo";
import { useConstant } from "@/libs/react/ref";
import { Dialog } from "@/libs/ui/dialog";
import { randomUUID } from "@/libs/uuid/uuid";
import { useBackgroundContext } from "@/mods/foreground/background/context";
import { SeedData } from "@/mods/universal/entities/seeds/data";
import { Base64 } from "@hazae41/base64";
import { Bytes } from "@hazae41/bytes";
import { useCloseContext } from "@hazae41/react-close-context";
import { Panic, Result } from "@hazae41/result";
import { WebAuthnStorage } from "@hazae41/webauthnstorage";
import { generateMnemonic, mnemonicToEntropy, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { SimpleInput, SimpleLabel, SimpleTextarea, WideShrinkableContrastButton, WideShrinkableGradientButton } from "../../../wallets/actions/send";
import { RawSeedCard } from "../../card";

export function StandaloneSeedCreatorDialog(props: {}) {
  const close = useCloseContext().getOrThrow()
  const background = useBackgroundContext().getOrThrow()

  const uuid = useConstant(() => randomUUID())

  const modhash = useModhash(uuid)
  const color = Color.get(modhash)

  const [rawNameInput = "", setRawNameInput] = useState<string>()

  const defNameInput = useDeferredValue(rawNameInput)

  const onNameInputChange = useInputChange(e => {
    setRawNameInput(e.currentTarget.value)
  }, [])

  const finalNameInput = useMemo(() => {
    return defNameInput || "Holder"
  }, [defNameInput])

  const [rawPhraseInput = "", setRawPhraseInput] = useState<string>()

  const defPhraseInput = useDeferredValue(rawPhraseInput)

  const onPhraseInputChange = useTextAreaChange(e => {
    setRawPhraseInput(e.currentTarget.value)
  }, [])

  const generate12OrAlert = useCallback(() => Errors.runAndLogAndAlertSync(() => {
    setRawPhraseInput(generateMnemonic(wordlist, 128))
  }), [])

  const generate24OrAlert = useCallback(() => Errors.runAndLogAndAlertSync(() => {
    setRawPhraseInput(generateMnemonic(wordlist, 256))
  }), [])

  const addUnauthenticatedOrAlert = useAsyncUniqueCallback(() => Errors.runAndLogAndAlert(async () => {
    if (!finalNameInput)
      throw new Panic()
    if (!defPhraseInput)
      throw new Panic()
    if (!isSafariExtension() && confirm("Did you backup your seed phrase?") === false)
      return

    const seed: SeedData = { type: "mnemonic", uuid, name: finalNameInput, color: Color.all.indexOf(color), mnemonic: defPhraseInput }

    await background.requestOrThrow<void>({
      method: "brume_createSeed",
      params: [seed]
    }).then(r => r.getOrThrow())

    close()
  }), [finalNameInput, defPhraseInput, uuid, color, background, close])

  const triedEncryptedPhrase = useAsyncReplaceMemo(() => Result.runAndWrap(async () => {
    if (!finalNameInput)
      throw new Panic()
    if (!defPhraseInput)
      throw new Panic()

    const entropyBytes = mnemonicToEntropy(defPhraseInput, wordlist)
    const entropyBase64 = Base64.get().getOrThrow().encodePaddedOrThrow(entropyBytes)

    const [ivBase64, cipherBase64] = await background.requestOrThrow<[string, string]>({
      method: "brume_encrypt",
      params: [entropyBase64]
    }).then(r => r.getOrThrow())

    return [ivBase64, cipherBase64]
  }), [finalNameInput, defPhraseInput, background])

  const [id, setId] = useState<Uint8Array>()

  useEffect(() => {
    setId(undefined)
  }, [defPhraseInput])

  const addAuthenticatedOrAlert1 = useAsyncUniqueCallback(() => Errors.runAndLogAndAlert(async () => {
    if (!finalNameInput)
      throw new Panic()
    if (triedEncryptedPhrase == null)
      throw new Panic()
    if (!isSafariExtension() && confirm("Did you backup your seed phrase?") === false)
      return

    const [_, cipherBase64] = triedEncryptedPhrase.getOrThrow()

    using cipherMemory = Base64.get().getOrThrow().decodePaddedOrThrow(cipherBase64)

    const idBytes = await WebAuthnStorage.createOrThrow(finalNameInput, cipherMemory.bytes)

    setId(idBytes)
  }), [finalNameInput, triedEncryptedPhrase])

  const addAuthenticatedOrAlert2 = useAsyncUniqueCallback(() => Errors.runAndLogAndAlert(async () => {
    if (id == null)
      throw new Panic()
    if (!finalNameInput)
      throw new Panic()
    if (triedEncryptedPhrase == null)
      throw new Panic()

    const [ivBase64, cipherBase64] = triedEncryptedPhrase.getOrThrow()

    using cipherMemory = Base64.get().getOrThrow().decodePaddedOrThrow(cipherBase64)
    const cipherBytes = await WebAuthnStorage.getOrThrow(id)

    if (!Bytes.equals(cipherMemory.bytes, cipherBytes))
      throw new Error(`Corrupt storage`)

    const idBase64 = Base64.get().getOrThrow().encodePaddedOrThrow(id)
    const mnemonic = { ivBase64, idBase64 }

    const seed: SeedData = { type: "authMnemonic", uuid, name: finalNameInput, color: Color.all.indexOf(color), mnemonic }

    await background.requestOrThrow<void>({
      method: "brume_createSeed",
      params: [seed]
    }).then(r => r.getOrThrow())

    close()
  }), [id, finalNameInput, triedEncryptedPhrase, uuid, color, background, close])

  const NameInput =
    <SimpleLabel>
      <div className="flex-none">
        Name
      </div>
      <div className="w-4" />
      <SimpleInput
        placeholder="Holder"
        value={rawNameInput}
        onChange={onNameInputChange} />
    </SimpleLabel>

  const PhraseInput =
    <div className="po-md flex flex-col bg-contrast rounded-xl">
      <div className="flex items-start">
        <div className="flex-none">
          Seed phrase
        </div>
        <div className="w-4" />
        <SimpleTextarea
          placeholder="candy climb cloth fetch crack miss gift direct then fork prevent already increase slam code"
          value={rawPhraseInput}
          onChange={onPhraseInputChange}
          rows={5} />
      </div>
      <div className="h-2" />
      <div className="flex items-center flex-wrap-reverse gap-2">
        <WideShrinkableContrastButton
          onClick={generate12OrAlert}>
          <Outline.KeyIcon className="size-5" />
          Generate 12 words
        </WideShrinkableContrastButton>
        <WideShrinkableContrastButton
          onClick={generate24OrAlert}>
          <Outline.KeyIcon className="size-5" />
          Generate 24 words
        </WideShrinkableContrastButton>
      </div>
    </div>

  const disabled = useMemo(() => {
    if (!validateMnemonic(defPhraseInput, wordlist))
      return "Please enter a valid seed phrase"
    return
  }, [defPhraseInput])

  const AddUnauthButton =
    <WideShrinkableContrastButton
      disabled={Boolean(disabled) || addUnauthenticatedOrAlert.loading}
      onClick={addUnauthenticatedOrAlert.run}>
      <Outline.PlusIcon className="size-5" />
      {disabled || "Add without authentication"}
    </WideShrinkableContrastButton>

  const AddAuthButton1 =
    <WideShrinkableGradientButton
      color={color}
      disabled={Boolean(disabled) || addAuthenticatedOrAlert1.loading}
      onClick={addAuthenticatedOrAlert1.run}>
      <Outline.LockClosedIcon className="size-5" />
      {disabled || "Add with authentication"}
    </WideShrinkableGradientButton>

  const AddAuthButton2 =
    <WideShrinkableGradientButton
      color={color}
      disabled={Boolean(disabled) || addAuthenticatedOrAlert2.loading}
      onClick={addAuthenticatedOrAlert2.run}>
      <Outline.LockClosedIcon className="size-5" />
      {disabled || "Add with authentication (1/2)"}
    </WideShrinkableGradientButton>

  return <>
    <Dialog.Title>
      New seed
    </Dialog.Title>
    <div className="h-4" />
    <div className="flex-1 flex flex-col items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="w-full aspect-video rounded-xl">
          <RawSeedCard
            name={finalNameInput}
            color={color} />
        </div>
      </div>
    </div>
    <div className="h-2" />
    <div className="flex-1 flex flex-col">
      <div className="grow" />
      {NameInput}
      <div className="h-2" />
      {PhraseInput}
      <div className="h-4" />
      <div className="flex items-center flex-wrap-reverse gap-2">
        {AddUnauthButton}
        {id == null
          ? AddAuthButton1
          : AddAuthButton2}
      </div>
    </div>
  </>
}