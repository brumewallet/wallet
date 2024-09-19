import { Coerced } from "./coerce"
import { NumberGuard } from "./guards/primitives"
import { Json } from "./json"
import { parse } from "./parse"

export namespace ZeroHexStringGuard {

  export function asOrThrow<X>(value: Coerced<X, string, `0x${string}`>): X & `0x${string}` {
    if (!value.startsWith("0x"))
      throw new Error()
    return value as X & `0x${string}`
  }

}

parse(() => null).asOrThrow(null)
parse(() => "hello" as const).asOrThrow("hello")
parse(() => 123 as const).asOrThrow(123)
parse(() => 123n as const).asOrThrow(123n)
parse(({ string }) => string).asOrThrow("hello")
parse(({ array, string }) => array(string)).asOrThrow(["hello"])

const MyObjectGuard = parse(({ readonly, optional, string }) => ({
  hello: readonly("world" as const),
  world: optional(string)
}))

const myObject = MyObjectGuard.asOrThrow({ hello: "world", world: "aaa" })

console.log(new Json<number>(JSON.stringify(123)).parseOrThrow(NumberGuard))