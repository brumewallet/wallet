import { ZeroHexBigInt } from "@/libs/bigints/bigints";
import { EthereumChainlessRpcRequestPreinit } from "@/mods/background/service_worker/entities/wallets/data";
import { EthereumContext } from "@/mods/universal/ethereum/mods/context";
import { Address, ZeroHexString } from "@hazae41/cubane";
import { createQuery, Data, JsonRequest, QueryStorage } from "@hazae41/glacier";
import { Nullable } from "@hazae41/option";
import { BlockNumber } from "../blocks";

export namespace GetBalance {

  export type K = JsonRequest.From<EthereumChainlessRpcRequestPreinit<unknown>>
  export type D = ZeroHexBigInt.From
  export type F = Error

  export function keyOrThrow(chainId: number, address: Address, block: BlockNumber) {
    const body = {
      method: "eth_getBalance",
      params: [address, block]
    } as const

    return new JsonRequest(`app:/ethereum/${chainId}`, { method: "POST", body })
  }

  export function queryOrThrow(context: Nullable<EthereumContext>, address: Nullable<Address>, block: Nullable<BlockNumber>, storage: QueryStorage) {
    if (context == null)
      return
    if (address == null)
      return
    if (block == null)
      return

    const fetcher = async (request: K, init: RequestInit = {}) => {
      const body = await JsonRequest.from(request).then(r => r.bodyAsJson)
      const fetched = await context.fetchOrThrow<ZeroHexString>(body, init)

      if (fetched.isErr())
        return fetched

      const cooldown = Date.now() + (1000 * 60)
      const expiration = Date.now() + (1000 * 60 * 60 * 24 * 365)

      return new Data(fetched.get(), { cooldown, expiration })
    }

    return createQuery<K, D, F>({
      key: keyOrThrow(context.chain.chainId, address, block),
      fetcher,
      storage
    })
  }

}