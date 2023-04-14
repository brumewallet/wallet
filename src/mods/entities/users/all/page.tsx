import { Colors } from "@/libs/colors/colors";
import { Outline } from "@/libs/icons/icons";
import { useBooleanState } from "@/libs/react/handles/boolean";
import { ClassNameProps } from "@/libs/react/props/className";
import { OkProps } from "@/libs/react/props/promise";
import { useCallback } from "react";
import { User, UserProps, useUser } from "../data";
import { UserCreateDialog } from "./create";
import { useUsers } from "./data";

export function UsersPage(props: OkProps<User>) {
  const { ok } = props

  const users = useUsers()

  const createDialog = useBooleanState()

  return <>
    {createDialog.current &&
      <UserCreateDialog
        close={createDialog.disable} />}
    <div className="h-full w-full p-4 flex justify-center items-center">
      <div className="flex flex-wrap items-center gap-8">
        {users.data?.map(user =>
          <UserOkButton
            key={user.uuid}
            user={user}
            ok={ok} />)}
        <NewUserButton ok={createDialog.enable} />
      </div>
    </div>
  </>
}

function UserOkButton(props: UserProps & OkProps<User>) {
  const { ok } = props

  const user = useUser(props.user.uuid)

  const onClick = useCallback(() => {
    ok(props.user)
  }, [props.user, ok])

  if (!user.data) return null

  return <button className="flex flex-col items-center"
    onClick={onClick}>
    <UserAvatar className="icon-7xl text-2xl"
      modhash={user.data.modhash}
      name={user.data.name} />
    <div className="h-1" />
    <div className="font-medium">
      {user.data.name}
    </div>
  </button>
}

function NewUserButton(props: OkProps<unknown>) {
  const { ok } = props

  return <button className="flex flex-col items-center"
    onClick={ok}>
    <div className="rounded-full icon-7xl flex justify-center items-center border border-contrast border-dashed">
      <Outline.PlusIcon className="icon-md" />
    </div>
    <div className="h-1" />
    <div className="font-medium">
      New user
    </div>
  </button>
}

export function UserAvatar(props: ClassNameProps & {
  modhash: number,
  name: string
}) {
  const { modhash, name, className } = props

  const color = Colors.get(modhash)
  const color2 = Colors.get(modhash + 1)

  return <div className={`bg-gradient-to-br from-${color} to-${color2} rounded-full flex justify-center items-center ${className} text-white`}>
    {name[0]}
  </div>
}