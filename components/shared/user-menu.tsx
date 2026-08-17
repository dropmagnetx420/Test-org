"use client";

import { useRouter } from "next/navigation";
import {
  HandCoins,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  User as UserIcon,
  Users,
  Wallet as WalletIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/actions/auth";
import { formatCurrency } from "@/lib/utils";
import type { Profile, Wallet } from "@/types/database";

function initials(profile: Profile) {
  const source = profile.full_name || profile.username || profile.email || "?";
  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function UserMenu({ profile, wallet }: { profile: Profile; wallet: Wallet | null }) {
  const router = useRouter();
  const isAdmin = profile.role === "admin" || profile.role === "super_admin";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-border/60 bg-card/60 py-1 pl-1 pr-3 backdrop-blur transition-colors hover:border-primary/50"
          aria-label="Account menu"
        >
          <Avatar className="size-7">
            {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt="" />}
            <AvatarFallback>{initials(profile)}</AvatarFallback>
          </Avatar>
          <span className="hidden font-mono text-xs font-medium tabular-nums sm:inline">
            {formatCurrency(wallet?.available_balance ?? 0)}
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="space-y-1">
          <p className="truncate text-sm font-medium">{profile.full_name ?? profile.email}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{profile.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="grid grid-cols-2 gap-1 px-2 py-1.5 text-xs">
          <div className="rounded-md bg-secondary/60 px-2 py-1.5">
            <p className="text-muted-foreground">Available</p>
            <p className="font-mono font-semibold tabular-nums">
              {formatCurrency(wallet?.available_balance ?? 0)}
            </p>
          </div>
          <div className="rounded-md bg-secondary/60 px-2 py-1.5">
            <p className="text-muted-foreground">Bonus</p>
            <p className="font-mono font-semibold tabular-nums text-primary">
              {formatCurrency(wallet?.bonus_balance ?? 0)}
            </p>
          </div>
        </div>
        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => router.push("/dashboard")}>
          <LayoutDashboard className="size-4" />
          Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/earn")}>
          <HandCoins className="size-4 text-amber-400" />
          Earn rewards
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/wallet")}>
          <WalletIcon className="size-4" />
          Wallet
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/referrals")}>
          <Users className="size-4" />
          Referrals
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/profile")}>
          <UserIcon className="size-4" />
          Profile
        </DropdownMenuItem>

        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push("/admin")}>
              <ShieldCheck className="size-4" />
              Admin panel
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-red-400 outline-none transition-colors hover:bg-red-500/10"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
