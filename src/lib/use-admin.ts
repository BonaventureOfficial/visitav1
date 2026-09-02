import { useEffect, useState } from "react";
import { amIAdmin } from "@/lib/ranking.functions";
import { useAuth } from "@/lib/auth";

/** True uniquement si le compte connecté possède le rôle admin (validé côté serveur). */
export function useIsAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    let alive = true;
    amIAdmin()
      .then((r) => alive && setIsAdmin(Boolean(r?.admin)))
      .catch(() => alive && setIsAdmin(false));
    return () => {
      alive = false;
    };
  }, [user]);
  return isAdmin;
}
