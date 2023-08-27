import { RpcRequestPreinit } from "@/libs/rpc";
import { Berith } from "@hazae41/berith";
import { Bytes } from "@hazae41/bytes";
import { Future } from "@hazae41/future";
import { None, Option, Some } from "@hazae41/option";
import { Err, Ok, Result } from "@hazae41/result";
import { CryptoClient } from "../crypto/client";
import { IrnClient } from "../irn/irn";

export interface WcMetadata {
  readonly name: string
  readonly description: string
  readonly url: string
  readonly icons: string[]
}

export interface WcSessionProposeParams {
  readonly proposer: {
    /**
     * base16
     */
    readonly publicKey: string
    readonly metadata: WcMetadata
  }

  readonly relays: {
    readonly protocol: string
  }[]

  readonly requiredNamespaces: any
  readonly optionalNamespaces: any
}

export interface WcSessionRequestParams<T = unknown> {
  /**
   * namespace:decimal
   */
  readonly chainId: `${string}:${string}`
  readonly request: RpcRequestPreinit<T>
}

export class WcSession {

  constructor(
    readonly client: CryptoClient,
    readonly metadata: WcMetadata
  ) { }

}

export interface WcParams {
  readonly protocol: "wc:"
  readonly version: "2"
  readonly pairingTopic: string
  readonly relayProtocol: "irn"
  readonly symKey: Bytes<32>
}

export namespace Wc {

  export const RELAY = "wss://relay.walletconnect.org"

  export function tryParse(url: string): Promise<Result<WcParams, Error>> {
    return Result.unthrow(async t => {
      const { protocol, pathname, searchParams } = new URL(url)

      if (protocol !== "wc:")
        return new Err(new Error(`Invalid protocol`))

      const [pairingTopic, version] = pathname.split("@")

      if (version !== "2")
        return new Err(new Error(`Invalid version`))

      const relayProtocol = Option.wrap(searchParams.get("relay-protocol")).ok().throw(t)

      if (relayProtocol !== "irn")
        return new Err(new Error(`Invalid relay protocol`))

      const symKeyHex = Option.wrap(searchParams.get("symKey")).ok().throw(t)
      const symKeyRaw = Bytes.fromHexSafe(symKeyHex)
      const symKey = Bytes.tryCast(symKeyRaw, 32).throw(t)

      return new Ok({ protocol, pairingTopic, version, relayProtocol, symKey })
    })
  }

  export function tryPair(irn: IrnClient, params: WcParams): Promise<Result<WcSession, Error>> {
    return Result.unthrow(async t => {
      const { pairingTopic, symKey } = params

      await irn.trySubscribe(pairingTopic).then(r => r.throw(t))
      const pairing = new CryptoClient(pairingTopic, symKey, irn)

      Berith.initSyncBundledOnce()

      const relay = { protocol: "irn" }
      const self = new Berith.X25519StaticSecret()

      const proposal = await pairing.events.wait("request", async (future: Future<RpcRequestPreinit<WcSessionProposeParams>>, request) => {
        if (request.method !== "wc_sessionPropose")
          return new None()
        future.resolve(request as RpcRequestPreinit<WcSessionProposeParams>)
        const responderPublicKey = Bytes.toHex(self.to_public().to_bytes())
        return new Some(new Ok({ relay, responderPublicKey }))
      }).inner

      const peer = Berith.X25519PublicKey.from_bytes(Bytes.fromHexSafe(proposal.params.proposer.publicKey))
      const shared = Bytes.tryCast(self.diffie_hellman(peer).to_bytes(), 32).throw(t)

      const hdfk_key = await crypto.subtle.importKey("raw", shared, "HKDF", false, ["deriveBits"])
      const hkdf_params = { name: "HKDF", hash: "SHA-256", info: new Uint8Array(), salt: new Uint8Array() }
      const key = new Uint8Array(await crypto.subtle.deriveBits(hkdf_params, hdfk_key, 8 * 32)) as Bytes<32>

      const sessionTopic = Bytes.toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", key)))

      await irn.trySubscribe(sessionTopic).then(r => r.throw(t))
      const session = new CryptoClient(sessionTopic, key, irn)

      {
        const { proposer, requiredNamespaces, optionalNamespaces } = proposal.params

        const namespaces = {
          eip155: {
            chains: ["eip155:1"],
            methods: ["eth_sendTransaction", "personal_sign", "eth_signTypedData", "eth_signTypedData_v4"],
            events: ["chainChanged", "accountsChanged"],
            accounts: ["eip155:1:0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"]
          }
        }

        const publicKey = Bytes.toHex(self.to_public().to_bytes())
        const metadata = { name: "Brume", description: "Brume", url: location.origin, icons: [] }
        const controller = { publicKey, metadata }
        const expiry = Math.floor((Date.now() + (7 * 24 * 60 * 60)) / 1000)
        const params = { relay, namespaces, requiredNamespaces, optionalNamespaces, pairingTopic, controller, expiry }

        await session.tryRequest<boolean>({ method: "wc_sessionSettle", params })
          .then(r => r.throw(t).throw(t))
          .then(Result.assert)
          .then(r => r.setErr(new Error(`false`)).throw(t))

        return new Ok(new WcSession(session, proposer.metadata))
      }
    })
  }

}