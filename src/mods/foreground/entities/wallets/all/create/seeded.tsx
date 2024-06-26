import { Color } from "@/libs/colors/colors";
import { Emojis } from "@/libs/emojis/emojis";
import { Errors, UIError } from "@/libs/errors/errors";
import { Outline } from "@/libs/icons/icons";
import { useModhash } from "@/libs/modhash/modhash";
import { useAsyncUniqueCallback } from "@/libs/react/callback";
import { useInputChange } from "@/libs/react/events";
import { useConstant } from "@/libs/react/ref";
import { Dialog, useCloseContext } from "@/libs/ui/dialog/dialog";
import { randomUUID } from "@/libs/uuid/uuid";
import { SeedRef } from "@/mods/background/service_worker/entities/seeds/data";
import { Wallet, WalletData } from "@/mods/background/service_worker/entities/wallets/data";
import { useBackgroundContext } from "@/mods/foreground/background/context";
import { Address, ZeroHexString } from "@hazae41/cubane";
import { Ledger } from "@hazae41/ledger";
import { Option } from "@hazae41/option";
import { Panic, Result } from "@hazae41/result";
import { secp256k1 } from "@noble/curves/secp256k1";
import { HDKey } from "@scure/bip32";
import { mnemonicToSeed } from "@scure/bip39";
import { SyntheticEvent, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { SeedInstance } from "../../../seeds/all/helpers";
import { useSeedDataContext } from "../../../seeds/context";
import { SimpleInput, SimpleLabel, WideShrinkableGradientButton } from "../../actions/send";
import { EmptyRectangularCard } from "./standalone";

export function SeededWalletCreatorDialog(props: {}) {
  const close = useCloseContext().unwrap()
  const background = useBackgroundContext().unwrap()
  const seedData = useSeedDataContext().unwrap()

  const uuid = useConstant(() => randomUUID())

  const modhash = useModhash(uuid)
  const color = Color.get(modhash)
  const emoji = Emojis.get(modhash)

  const [rawNameInput = "", setRawNameInput] = useState<string>()

  const defNameInput = useDeferredValue(rawNameInput)

  const onNameInputChange = useInputChange(e => {
    setRawNameInput(e.currentTarget.value)
  }, [])

  const finalNameInput = useMemo(() => {
    return defNameInput || "Holder"
  }, [defNameInput])

  const [rawPathInput = "", setRawPathInput] = useState<string>()

  const defPathInput = useDeferredValue(rawPathInput)

  const onPathInputChange = useInputChange(e => {
    setRawPathInput(e.currentTarget.value)
  }, [])

  const [rawDerivation, setRawDerivation] = useState<string>("eth-metamask")

  const onDerivationChange = useCallback((e: SyntheticEvent<HTMLSelectElement>) => {
    setRawDerivation(e.currentTarget.value)
  }, [])

  const [rawIndexInput = "", setRawIndexInput] = useState<string>("0")

  const defIndexInput = useDeferredValue(rawIndexInput)

  const onIndexInputChange = useInputChange(e => {
    setRawIndexInput(e.currentTarget.value)
  }, [])

  useEffect(() => {
    if (rawDerivation === "custom")
      return setRawPathInput(undefined)

    const i = Number(defIndexInput).toFixed()

    if (rawDerivation === "eth-metamask")
      return setRawPathInput(`m/44'/60'/0'/0/${i}`)
    if (rawDerivation === "eth-ledger")
      return setRawPathInput(`m/44'/60'/${i}'/0/0`)
    if (rawDerivation === "etc-metamask")
      return setRawPathInput(`m/44'/61'/0'/0/${i}`)
    if (rawDerivation === "etc-ledger")
      return setRawPathInput(`m/44'/61'/${i}'/0/0`)
  }, [rawDerivation, defIndexInput])

  const canAdd = useMemo(() => {
    if (!finalNameInput)
      return false
    if (!defPathInput)
      return false
    return true
  }, [finalNameInput, defPathInput])

  const addOrAlert = useAsyncUniqueCallback(() => Errors.runAndLogAndAlert(async () => {
    if (!finalNameInput)
      throw new Panic()

    if (seedData.type === "ledger") {
      const device = await Result.runAndWrap(async () => {
        return await Ledger.USB.getOrRequestDeviceOrThrow()
      }).then(r => r.mapErrSync(cause => {
        return new UIError(`Could not find device`, { cause })
      }).unwrap())

      const connector = await Result.runAndWrap(async () => {
        return await Ledger.USB.connectOrThrow(device)
      }).then(r => r.mapErrSync(cause => {
        return new UIError(`Could not connect to the device`, { cause })
      }).unwrap())

      const { address } = await Ledger.Ethereum.tryGetAddress(connector, defPathInput.slice(2)).then(r => r.mapErrSync(cause => {
        return new UIError(`Could not get the address of the device`, { cause })
      }).unwrap())

      if (!ZeroHexString.is(address))
        throw new UIError(`Could not get the address of the device`)

      const seed = SeedRef.from(seedData)

      const wallet: WalletData = { coin: "ethereum", type: "seeded", uuid, name: finalNameInput, color: Color.all.indexOf(color), emoji, address, seed, path: defPathInput }

      await background.requestOrThrow<Wallet[]>({
        method: "brume_createWallet",
        params: [wallet]
      }).then(r => r.mapErrSync(cause => {
        return new UIError(`Could not create the wallet`, { cause })
      }).unwrap())

    } else {
      const instance = await SeedInstance.tryFrom(seedData, background).then(r => r.get())

      const mnemonic = await instance.tryGetMnemonic(background).then(r => r.mapErrSync(cause => {
        return new UIError(`Could not get mnemonic`, { cause })
      }).unwrap())

      const masterSeed = await Result.runAndWrap(async () => {
        return await mnemonicToSeed(mnemonic)
      }).then(r => r.unwrap())

      const root = Result.runAndWrapSync(() => {
        return HDKey.fromMasterSeed(masterSeed)
      }).unwrap()

      const child = Result.runAndWrapSync(() => {
        return root.derive(defPathInput)
      }).mapErrSync((cause) => {
        return new UIError(`Invalid derivation path`, { cause })
      }).unwrap()

      const privateKeyBytes = Option.unwrap(child.privateKey)
      const uncompressedPublicKeyBytes = secp256k1.getPublicKey(privateKeyBytes, false)

      const address = Address.compute(uncompressedPublicKeyBytes)
      const seed = SeedRef.from(seedData)

      const wallet: WalletData = { coin: "ethereum", type: "seeded", uuid, name: finalNameInput, color: Color.all.indexOf(color), emoji, address, seed, path: defPathInput }

      await background.requestOrThrow<Wallet[]>({
        method: "brume_createWallet",
        params: [wallet]
      }).then(r => r.mapErrSync(cause => {
        return new UIError(`Could not create the wallet`, { cause })
      }).unwrap())
    }

    close()
  }), [finalNameInput, defPathInput, seedData, defPathInput, uuid, color, emoji, background, close])

  const NameInput =
    <SimpleLabel>
      <div className="shrink-0">
        Name
      </div>
      <div className="w-4" />
      <SimpleInput
        placeholder="Holder"
        value={rawNameInput}
        onChange={onNameInputChange} />
    </SimpleLabel>

  const PathInput =
    <SimpleLabel>
      <div className="shrink-0">
        Path
      </div>
      <div className="w-4" />
      <SimpleInput
        placeholder="m/44'/60'/0'/0/0"
        value={rawPathInput}
        onChange={onPathInputChange} />
    </SimpleLabel>

  const IndexInput =
    <SimpleLabel>
      <div className="shrink-0">
        Index
      </div>
      <div className="w-4" />
      <SimpleInput
        placeholder="0"
        type="number"
        min={0}
        value={rawIndexInput}
        onChange={onIndexInputChange} />
    </SimpleLabel>

  const AddButon =
    <WideShrinkableGradientButton
      color={color}
      disabled={!finalNameInput || !canAdd}
      onClick={addOrAlert.run}>
      <Outline.PlusIcon className="size-5" />
      Add
    </WideShrinkableGradientButton>

  return <>
    <Dialog.Title>
      New wallet
    </Dialog.Title>
    <div className="h-4" />
    <div className="flex-1 flex flex-col items-center justify-center">
      <div className="w-full max-w-sm">
        <EmptyRectangularCard />
      </div>
    </div>
    <div className="h-2" />
    <div className="flex-1 flex flex-col">
      <div className="grow" />
      {NameInput}
      <div className="h-2" />
      <SimpleLabel>
        <div className="shrink-0">
          Derivation
        </div>
        <div className="w-4" />
        <select className="w-full bg-transparent outline-none overflow-ellipsis overflow-x-hidden appearance-none"
          value={rawDerivation}
          onChange={onDerivationChange}>
          <option value="eth-metamask">
            {`Ethereum — MetaMask-like — m/44'/60'/0'/0/x`}
          </option>
          <option value="eth-ledger">
            {`Ethereum — Ledger-like - m/44'/60'/x'/0/0`}
          </option>
          <option value="etc-metamask">
            {`Ethereum Classic — MetaMask-like — m/44'/61'/0'/0/x`}
          </option>
          <option value="etc-metamask">
            {`Ethereum Classic — Ledger-like - m/44'/61'/x'/0/0`}
          </option>
          <option value="custom">
            Custom
          </option>
        </select>
      </SimpleLabel>
      {rawDerivation === "custom" && <>
        <div className="h-2" />
        {PathInput}
      </>}
      {rawDerivation !== "custom" && <>
        <div className="h-2" />
        {IndexInput}
      </>}
      <div className="h-4" />
      <div className="flex items-center flex-wrap-reverse gap-2">
        {AddButon}
      </div>
    </div>
  </>
}
