"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownAZ,
  CheckCircle2,
  Circle,
  Copy,
  FolderPlus,
  List,
  LogIn,
  LogOut,
  Menu,
  Pencil,
  Plus,
  Settings,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Category = {
  id: string;
  household_id: string;
  name: string;
  created_at: string;
};

type Task = {
  id: string;
  title: string;
  is_completed: boolean;
  assigned_to: string | null;
  household_id: string;
  user_email: string;
  category_id: string | null;
  created_at: string;
};

type Member = {
  email: string | null;
  full_name: string | null;
};

const ALLOWED_EMAILS = ["rahulcode19@gmail.com", "riddhi.icct@gmail.com"];

export default function Home() {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userFullName, setUserFullName] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [householdName, setHouseholdName] = useState<string | null>(null);
  const [householdNameDraft, setHouseholdNameDraft] = useState("");
  const [isEditingHouseholdName, setIsEditingHouseholdName] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);
  const [sortFilter, setSortFilter] = useState<"all" | "me" | "wife" | "unassigned">("all");
  const [sortOrder, setSortOrder] = useState<"date" | "assignment">("date");

  const isAllowed = useMemo(() => {
    if (!sessionEmail) return false;
    return ALLOWED_EMAILS.includes(sessionEmail);
  }, [sessionEmail]);

  const inviteLink = useMemo(() => {
    if (!inviteCode) return null;
    return `family-task.app/join?code=${inviteCode}`;
  }, [inviteCode]);

  const filteredAndSortedTasks = useMemo(() => {
    let list = [...tasks];
    if (sortFilter === "me") {
      list = list.filter((t) => t.assigned_to === "Rahul");
    } else if (sortFilter === "wife") {
      list = list.filter((t) => t.assigned_to === "Wife");
    } else if (sortFilter === "unassigned") {
      list = list.filter((t) => !t.assigned_to || t.assigned_to === "Unassigned");
    }
    if (sortOrder === "assignment") {
      const order = (a: Task, b: Task) => {
        const rank = (x: string | null) =>
          x === "Rahul" ? 0 : x === "Wife" ? 1 : 2;
        return rank(a.assigned_to) - rank(b.assigned_to);
      };
      list.sort(order);
    }
    return list;
  }, [tasks, sortFilter, sortOrder]);

  const displayNameFromEmail = (email: string) => {
    const namePart = email.split("@")[0] ?? "";
    if (!namePart) return email;
    return namePart
      .replace(/[._-]+/g, " ")
      .split(" ")
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(" ");
  };

  const loadCategories = useCallback(async (household: string) => {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("household_id", household)
      .order("created_at", { ascending: false });

    if (error) {
      if (error.message.includes("does not exist")) {
        setMessage(
          "Run supabase-livelist.sql in Supabase to enable livelists.",
        );
        setCategories([]);
        return;
      }
      setMessage(`Unable to load categories: ${error.message}`);
      return;
    }

    setCategories((data ?? []) as Category[]);
  }, []);

  const loadTasks = useCallback(
    async (household: string, categoryId: string | null) => {
      setIsLoadingTasks(true);
      let query = supabase
        .from("tasks")
        .select("*")
        .eq("household_id", household)
        .order("created_at", { ascending: false });

      if (categoryId) {
        query = query.eq("category_id", categoryId);
      }

      const { data, error } = await query;

      if (error) {
        setMessage(`Unable to load tasks: ${error.message}`);
        setIsLoadingTasks(false);
        return;
      }

      setTasks((data ?? []) as Task[]);
      setIsLoadingTasks(false);
    },
    [],
  );

  const createHouseholdForProfile = useCallback(
    async (profileId: string, email: string) => {
      const { data: household, error: householdError } = await supabase
        .from("households")
        .insert({ name: "Our Home" })
        .select("id")
        .single();

      if (householdError || !household?.id) {
        setMessage(
          `Unable to create a household: ${
            householdError?.message ?? "Unknown error."
          }`,
        );
        return;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ household_id: household.id })
        .eq("id", profileId);

      if (updateError) {
        setMessage(`Unable to link household: ${updateError.message}`);
        return;
      }

      setSessionEmail(email.toLowerCase());
      setHouseholdId(household.id);
    },
    [],
  );

  const loadProfile = useCallback(
    async (profileId: string, email: string, fullName: string | null) => {
      const resolvedEmail = email.toLowerCase();
      const resolvedName =
        fullName || displayNameFromEmail(resolvedEmail);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, household_id, full_name")
        .eq("id", profileId)
        .maybeSingle();

      if (error) {
        if (error.message.includes("profiles.full_name does not exist")) {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from("profiles")
            .select("id, email, household_id")
            .eq("id", profileId)
            .maybeSingle();

          if (fallbackError) {
            setMessage(`Unable to load profile: ${fallbackError.message}`);
            return;
          }

          const fallbackEmail = (fallbackData?.email ?? resolvedEmail).toLowerCase();
          setSessionEmail(fallbackEmail);

          if (!fallbackData) {
            const { error: insertError } = await supabase
              .from("profiles")
              .insert({ id: profileId, email: fallbackEmail });

            if (insertError) {
              setMessage(`Unable to create profile: ${insertError.message}`);
              return;
            }

            await createHouseholdForProfile(profileId, fallbackEmail);
            return;
          }

          if (!fallbackData.household_id) {
            await createHouseholdForProfile(profileId, fallbackEmail);
            return;
          }

          setHouseholdId(fallbackData.household_id);
          return;
        }

        setMessage(`Unable to load profile: ${error.message}`);
        return;
      }

      const emailFromProfile = (data?.email ?? resolvedEmail).toLowerCase();
      setSessionEmail(emailFromProfile);

      if (!data) {
        const { error: insertError } = await supabase.from("profiles").insert({
          id: profileId,
          email: emailFromProfile,
          full_name: resolvedName,
        });

        if (insertError) {
          setMessage(`Unable to create profile: ${insertError.message}`);
          return;
        }

        await createHouseholdForProfile(profileId, emailFromProfile);
        return;
      }

      if (!data.full_name && resolvedName) {
        await supabase
          .from("profiles")
          .update({ full_name: resolvedName })
          .eq("id", profileId);
      }

      if (!data.household_id) {
        await createHouseholdForProfile(profileId, emailFromProfile);
        return;
      }

      setHouseholdId(data.household_id);
    },
    [createHouseholdForProfile],
  );

  const loadHousehold = useCallback(async (household: string) => {
    const { data, error } = await supabase
      .from("households")
      .select("id, invite_code, name")
      .eq("id", household)
      .single();

    if (error) {
      setMessage(`Unable to load household: ${error.message}`);
      return;
    }

    const resolvedName = data?.name ?? "Our Home";
    setInviteCode(data?.invite_code ?? null);
    setHouseholdName(resolvedName);
    setHouseholdNameDraft(resolvedName);
  }, []);

  const handleDeleteCategory = useCallback(
    async (categoryId: string) => {
      setMessage(null);
      if (selectedCategoryId === categoryId) {
        setSelectedCategoryId(null);
      }
      setCategories((c) => c.filter((cat) => cat.id !== categoryId));
      setDeleteCategoryId(null);

      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", categoryId);

      if (error) {
        setMessage(`Unable to delete board: ${error.message}`);
        loadCategories(householdId!);
      }
    },
    [householdId, loadCategories, selectedCategoryId],
  );

  const createCategory = useCallback(
    async (name: string) => {
      if (!householdId) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      setIsAddingCategory(true);
      setMessage(null);

      const { data, error } = await supabase
        .from("categories")
        .insert({ household_id: householdId, name: trimmed })
        .select("id")
        .single();

      if (error) {
        setMessage(`Unable to create list: ${error.message}`);
      } else if (data?.id) {
        setNewCategoryName("");
        setSelectedCategoryId(data.id);
      }

      setIsAddingCategory(false);
    },
    [householdId],
  );

  const loadMembers = useCallback(async (household: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("household_id", household)
      .order("full_name", { ascending: true });

    if (error) {
      if (error.message.includes("profiles.full_name does not exist")) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("profiles")
          .select("email")
          .eq("household_id", household)
          .order("email", { ascending: true });

        if (fallbackError) {
          setMessage(`Unable to load members: ${fallbackError.message}`);
          return;
        }

        setMembers((fallbackData ?? []).map((item) => ({
          email: item.email ?? null,
          full_name: null,
        })));
        return;
      }

      setMessage(`Unable to load members: ${error.message}`);
      return;
    }

    setMembers((data ?? []) as Member[]);
  }, []);

  const joinHousehold = useCallback(
    async (code: string, profileId: string) => {
      setIsJoining(true);
      setMessage(null);

      const { data, error } = await supabase
        .from("households")
        .select("id, invite_code")
        .eq("invite_code", code)
        .single();

      if (error || !data?.id) {
        setMessage("That invite code is not valid.");
        setIsJoining(false);
        return;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ household_id: data.id })
        .eq("id", profileId);

      if (updateError) {
        setMessage(`Unable to join household: ${updateError.message}`);
        setIsJoining(false);
        return;
      }

      setHouseholdId(data.id);
      setInviteCode(data.invite_code ?? null);
      window.history.replaceState({}, "", window.location.pathname);
      setMessage("Joined household successfully.");
      setIsJoining(false);
    },
    [],
  );

  useEffect(() => {
    let isMounted = true;

    const initSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;

      const email = data.session?.user?.email?.toLowerCase() ?? null;
      const id = data.session?.user?.id ?? null;
      const fullName =
        (data.session?.user?.user_metadata?.full_name as string | undefined) ??
        (data.session?.user?.user_metadata?.name as string | undefined) ??
        null;
      setSessionEmail(email);
      setUserId(id);
      setUserFullName(fullName);
      setIsInitializing(false);
    };

    initSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_, newSession) => {
        const email = newSession?.user?.email?.toLowerCase() ?? null;
        const id = newSession?.user?.id ?? null;
        const fullName =
          (newSession?.user?.user_metadata?.full_name as
            | string
            | undefined) ??
          (newSession?.user?.user_metadata?.name as string | undefined) ??
          null;
        setSessionEmail(email);
        setUserId(id);
        setUserFullName(fullName);
      },
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!sessionEmail || !userId) {
      setTasks([]);
      setHouseholdId(null);
      return;
    }

    if (!ALLOWED_EMAILS.includes(sessionEmail)) {
      setMessage("Access is restricted to approved family emails.");
      supabase.auth.signOut();
      setSessionEmail(null);
      setUserId(null);
      return;
    }

    setMessage(null);
    loadProfile(userId, sessionEmail, userFullName);
  }, [loadProfile, sessionEmail, userFullName, userId]);

  useEffect(() => {
    if (!sessionEmail || !userId) return;
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) return;
    joinHousehold(code, userId);
  }, [joinHousehold, sessionEmail, userId]);

  useEffect(() => {
    if (!householdId) {
      setTasks([]);
      setCategories([]);
      setMembers([]);
      setInviteCode(null);
      setHouseholdName(null);
      return;
    }

    loadHousehold(householdId);
    loadMembers(householdId);
    loadCategories(householdId);
  }, [householdId, loadHousehold, loadMembers, loadCategories]);

  useEffect(() => {
    if (
      selectedCategoryId &&
      !categories.some((c) => c.id === selectedCategoryId)
    ) {
      setSelectedCategoryId(null);
    }
  }, [categories, selectedCategoryId]);

  useEffect(() => {
    if (!householdId) return;

    loadTasks(householdId, selectedCategoryId);

    const channel = supabase
      .channel("tasks-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          const task = payload.new as Task | undefined;
          const oldTask = payload.old as Task | undefined;
          if (selectedCategoryId && task?.category_id !== selectedCategoryId && oldTask?.category_id !== selectedCategoryId) {
            if (payload.eventType === "INSERT") return;
            if (payload.eventType === "DELETE") return;
          }
          setTasks((current) => {
            const eventType = payload.eventType;
            if (eventType === "INSERT") {
              const newTask = payload.new as Task;
              if (selectedCategoryId && newTask.category_id !== selectedCategoryId) return current;
              return [newTask, ...current];
            }
            if (eventType === "UPDATE") {
              const updated = payload.new as Task;
              if (selectedCategoryId && updated.category_id !== selectedCategoryId) {
                return current.filter((t) => t.id !== updated.id);
              }
              return current.map((t) => (t.id === updated.id ? updated : t));
            }
            if (eventType === "DELETE") {
              return current.filter((task) => task.id !== (payload.old as { id: string }).id);
            }
            return current;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, selectedCategoryId, loadTasks]);

  useEffect(() => {
    if (!householdId) return;

    const channel = supabase
      .channel("categories-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "categories",
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          setCategories((current) => {
            const eventType = payload.eventType;
            if (eventType === "INSERT") return [(payload.new as Category), ...current];
            if (eventType === "UPDATE") {
              return current.map((c) =>
                c.id === payload.new.id ? (payload.new as Category) : c,
              );
            }
            if (eventType === "DELETE") {
              return current.filter((c) => c.id !== (payload.old as { id: string }).id);
            }
            return current;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, selectedCategoryId]);

  const handleGoogleSignIn = async () => {
    setMessage(null);
    const redirectTo = (
      process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    ).replace(/\/$/, "");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });

    if (error) {
      setMessage(`Google sign-in failed: ${error.message}`);
    }
  };

  const handleSignOut = async () => {
    setMessage(null);
    await supabase.auth.signOut();
    setSessionEmail(null);
    setUserId(null);
    setUserFullName(null);
    setHouseholdId(null);
    setCategories([]);
    setSelectedCategoryId(null);
    setMembers([]);
    setInviteCode(null);
    setHouseholdName(null);
  };

  const handleAddTask = async () => {
    if (!sessionEmail || !householdId || !newTask.trim()) return;
    if (!selectedCategoryId) return;
    setIsSaving(true);
    setMessage(null);

    const { error } = await supabase.from("tasks").insert({
      title: newTask.trim(),
      user_email: sessionEmail,
      is_completed: false,
      household_id: householdId,
      category_id: selectedCategoryId,
    });

    if (error) {
      setMessage(`Unable to add task: ${error.message}`);
    } else {
      setNewTask("");
    }

    setIsSaving(false);
  };

  const handleToggleTask = async (task: Task) => {
    setMessage(null);
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id
          ? { ...item, is_completed: !item.is_completed }
          : item,
      ),
    );

    const { error } = await supabase
      .from("tasks")
      .update({ is_completed: !task.is_completed })
      .eq("id", task.id);

    if (error) {
      setMessage(`Unable to update task: ${error.message}`);
      setTasks((current) =>
        current.map((item) =>
          item.id === task.id ? { ...item, is_completed: task.is_completed } : item,
        ),
      );
    }
  };

  const handleDeleteTask = async (task: Task) => {
    setMessage(null);
    setTasks((current) => current.filter((item) => item.id !== task.id));

    const { error } = await supabase.from("tasks").delete().eq("id", task.id);

    if (error) {
      setMessage(`Unable to delete task: ${error.message}`);
      setTasks((current) => [task, ...current]);
    }
  };

  const handleAssignTask = async (task: Task, assignee: string) => {
    setMessage(null);
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id ? { ...item, assigned_to: assignee } : item,
      ),
    );

    const { error } = await supabase
      .from("tasks")
      .update({ assigned_to: assignee })
      .eq("id", task.id);

    if (error) {
      setMessage(`Unable to assign task: ${error.message}`);
      setTasks((current) =>
        current.map((item) =>
          item.id === task.id ? { ...item, assigned_to: task.assigned_to } : item,
        ),
      );
    }
  };

  const creatorLabel = (email: string) =>
    email === "rahulcode19@gmail.com" ? "Rahul" : "Wife";
  const creatorInitials = (email: string) =>
    email === "rahulcode19@gmail.com" ? "R" : "W";

  const handleCopyLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setMessage("Invite link copied!");
      setTimeout(() => setMessage(null), 2000);
    } catch {
      setMessage("Unable to copy link.");
    }
  };

  const handleHouseholdNameSave = async () => {
    if (!householdId) return;
    const trimmed = householdNameDraft.trim();
    if (!trimmed) return;
    setMessage(null);

    const previous = householdName;
    setHouseholdName(trimmed);

    const { error } = await supabase
      .from("households")
      .update({ name: trimmed })
      .eq("id", householdId);

    if (error) {
      setMessage(`Unable to update household name: ${error.message}`);
      setHouseholdName(previous ?? "Our Home");
    } else {
      setMessage("Household name updated.");
      setTimeout(() => setMessage(null), 2000);
    }
    setIsEditingHouseholdName(false);
  };

  const handleHouseholdNameEdit = () => {
    setHouseholdNameDraft(householdName ?? "Our Home");
    setIsEditingHouseholdName(true);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await handleAddTask();
  };

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-[#323338]">
      <main className="relative flex min-h-screen w-full flex-col pb-24 md:flex-row">
        <div className="flex items-center justify-between border-b border-[#e6e9ef] bg-white px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm"
          >
            <Menu className="h-4 w-4 text-[#323338]" />
            Menu
          </button>
          {sessionEmail && isAllowed ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#323338] hover:bg-[#e6e9ef]"
                aria-label="Settings"
              >
                <Settings className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-2 rounded-lg bg-[#e6e9ef] px-3 py-2 text-sm font-medium text-[#323338] hover:bg-[#c5c7d0]"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          ) : null}
        </div>

        <div
          className={`fixed inset-0 z-40 bg-black/40 transition md:hidden ${
            isSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />

        <aside
          className={`fixed left-0 top-0 z-50 h-full w-64 transform bg-[#2d2d2d] p-5 transition md:static md:z-auto md:h-auto md:translate-x-0 ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-4 md:hidden">
            <span className="text-sm font-semibold text-white/80">Menu</span>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="rounded-lg p-2 text-white/60 hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 flex flex-col gap-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
                Workspace
              </p>
              <div className="mt-2 flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">
                  {householdName ?? "Our Home"}
                </h2>
                <button
                  type="button"
                  onClick={handleHouseholdNameEdit}
                  className="rounded p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
                  aria-label="Edit household name"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
              {isEditingHouseholdName ? (
                <div className="mt-2 flex flex-col gap-2">
                  <input
                    type="text"
                    value={householdNameDraft}
                    onChange={(e) => setHouseholdNameDraft(e.target.value)}
                    placeholder="Workspace name"
                    className="rounded-lg border-0 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:ring-2 focus:ring-[#5034ff]"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleHouseholdNameSave}
                      className="rounded-lg bg-[#5034ff] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4028e6]"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingHouseholdName(false)}
                      className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/15"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
              {sessionEmail ? (
                <p className="mt-2 truncate text-xs text-white/50">{sessionEmail}</p>
              ) : null}
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
                Members
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {members.length === 0 ? (
                  <span className="text-xs text-white/50">No members yet</span>
                ) : (
                  members.map((member) => (
                    <span
                      key={`${member.email ?? "member"}-${member.full_name ?? "name"}`}
                      className="inline-flex items-center rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-white/90"
                    >
                      {member.full_name ||
                        (member.email ? displayNameFromEmail(member.email) : "Member")}
                    </span>
                  ))
                )}
              </div>
            </div>

            {householdId ? (
              <div className="flex flex-1 flex-col gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
                  My Boards
                </p>
                <div className="flex flex-col gap-1">
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      className={`group flex items-center gap-2 rounded-lg transition ${
                        selectedCategoryId === cat.id
                          ? "bg-[#5034ff]"
                          : "hover:bg-white/10"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedCategoryId(
                            selectedCategoryId === cat.id ? null : cat.id,
                          )
                        }
                        className={`flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium transition ${
                          selectedCategoryId === cat.id
                            ? "text-white"
                            : "text-white/80 hover:text-white"
                        }`}
                      >
                        <List className="h-4 w-4 shrink-0 opacity-80" />
                        <span className="truncate">{cat.name}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteCategoryId(cat.id);
                        }}
                        className="shrink-0 rounded p-1.5 text-white/40 transition hover:bg-white/20 hover:text-white"
                        aria-label="Delete board"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <div className="mt-1 flex flex-col gap-2">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          createCategory(newCategoryName);
                        }
                      }}
                      placeholder="New board..."
                      className="w-full min-w-0 rounded-lg border-0 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:ring-2 focus:ring-[#5034ff]"
                    />
                    <button
                      type="button"
                      onClick={() => createCategory(newCategoryName)}
                      disabled={isAddingCategory || !newCategoryName.trim()}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/15 disabled:opacity-50"
                    >
                      <FolderPlus className="h-4 w-4 shrink-0" />
                      Add board
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </aside>

        {/* Settings panel */}
        <div
          className={`fixed inset-0 z-40 bg-slate-950/40 transition ${
            isSettingsOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={() => setIsSettingsOpen(false)}
          aria-hidden="true"
        />
        <aside
          className={`fixed right-0 top-0 z-50 h-full w-80 transform bg-white p-6 shadow-2xl transition md:w-96 ${
            isSettingsOpen ? "translate-x-0" : "translate-x-full"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-[#e6e9ef] pb-4">
            <h2 className="text-lg font-semibold text-[#323338]">Settings</h2>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className="rounded-lg p-2 text-[#323338]/60 hover:bg-[#f6f7fb]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-6 flex flex-col gap-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#323338]/50">
                Invite to workspace
              </p>
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-[#e6e9ef] bg-[#f6f7fb] px-3 py-2.5">
                <span className="flex-1 truncate text-sm text-[#323338]">
                  {inviteLink ?? "Invite link not ready"}
                </span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  disabled={!inviteLink}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#5034ff] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4028e6] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </button>
              </div>
              {isJoining ? (
                <p className="mt-2 text-xs text-[#323338]/50">Joining workspace...</p>
              ) : null}
            </div>
          </div>
        </aside>

        {/* Delete board confirmation modal */}
        {deleteCategoryId ? (
          <>
            <div
              className="fixed inset-0 z-[60] bg-black/50"
              onClick={() => setDeleteCategoryId(null)}
              aria-hidden="true"
            />
            <div
              className="fixed left-1/2 top-1/2 z-[70] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100">
                  <Trash2 className="h-5 w-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#323338]">
                    Delete board?
                  </h3>
                  <p className="mt-1 text-sm text-[#323338]/60">
                    This will permanently delete "{categories.find((c) => c.id === deleteCategoryId)?.name}" and all its items.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteCategoryId(null)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-[#323338] hover:bg-[#f6f7fb]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(deleteCategoryId)}
                  className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600"
                >
                  Delete
                </button>
              </div>
            </div>
          </>
        ) : null}

        <section className="flex min-h-screen flex-1 flex-col bg-[#f6f7fb]">
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#e6e9ef] bg-white px-6 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-[#323338]">
                {categories.find((c) => c.id === selectedCategoryId)?.name ?? "Shared Lists"}
              </h1>
              {selectedCategoryId && (
                <span className="rounded-md bg-[#e6e9ef] px-2 py-0.5 text-xs font-medium text-[#323338]/70">
                  Live
                </span>
              )}
            </div>
            {sessionEmail && isAllowed ? (
              <div className="hidden items-center gap-2 md:flex">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[#323338] hover:bg-[#f6f7fb]"
                  aria-label="Settings"
                >
                  <Settings className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex items-center gap-2 rounded-lg bg-[#e6e9ef] px-3 py-2 text-sm font-medium text-[#323338] hover:bg-[#c5c7d0]"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            ) : null}
          </header>

          {message ? (
            <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              <Sparkles className="h-4 w-4 shrink-0" />
              {message}
            </div>
          ) : null}

          <div className="flex flex-1 flex-col p-6">
            {isInitializing ? (
              <div className="rounded-lg bg-white p-8 shadow-sm">
                <p className="text-sm text-[#323338]/60">Loading your workspace...</p>
              </div>
            ) : !sessionEmail || !isAllowed ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#e6e9ef] bg-white px-8 py-16 text-center">
                <p className="text-lg font-medium text-[#323338]">Welcome to Livelist</p>
                <p className="mt-2 text-sm text-[#323338]/60">
                  Sign in with your family email to start sharing lists
                </p>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[#5034ff] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4028e6]"
                >
                  <LogIn className="h-4 w-4" />
                  Sign in with Google
                </button>
              </div>
            ) : !householdId ? (
              <div className="rounded-lg bg-white p-8 text-center shadow-sm">
                <p className="text-sm text-[#323338]/60">
                  Join a workspace to see shared lists.
                </p>
              </div>
            ) : (
              <>
                {!selectedCategoryId ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#e6e9ef] bg-white py-20 text-center">
                    <List className="h-14 w-14 text-[#c5c7d0]" />
                    <p className="mt-4 text-base font-medium text-[#323338]">
                      Select a board from the sidebar
                    </p>
                    <p className="mt-1 text-sm text-[#323338]/50">
                      Or create a new one to get started
                    </p>
                  </div>
                ) : isLoadingTasks ? (
                  <div className="rounded-lg bg-white p-8 shadow-sm">
                    <p className="text-sm text-[#323338]/60">Loading items...</p>
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#e6e9ef] bg-white py-16 text-center">
                    <Plus className="h-12 w-12 text-[#c5c7d0]" />
                    <p className="mt-3 text-sm font-medium text-[#323338]">
                      No items yet
                    </p>
                    <p className="mt-1 text-xs text-[#323338]/50">
                      Add your first item using the bar below
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-[#323338]/60">
                        <ArrowDownAZ className="h-3.5 w-3.5" />
                        Sort by:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {(["all", "me", "wife", "unassigned"] as const).map((key) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setSortFilter(key)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                              sortFilter === key
                                ? "bg-[#5034ff] text-white"
                                : "bg-white text-[#323338]/70 shadow-sm hover:bg-[#f6f7fb]"
                            }`}
                          >
                            {key === "all"
                              ? "All"
                              : key === "me"
                                ? "Me"
                                : key === "wife"
                                  ? "Wife"
                                  : "Unassigned"}
                          </button>
                        ))}
                      </div>
                      <span className="mx-2 text-[#323338]/30">|</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setSortOrder("date")}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                            sortOrder === "date"
                              ? "bg-[#e6e9ef] text-[#323338]"
                              : "text-[#323338]/60 hover:bg-[#f6f7fb]"
                          }`}
                        >
                          Newest
                        </button>
                        <button
                          type="button"
                          onClick={() => setSortOrder("assignment")}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                            sortOrder === "assignment"
                              ? "bg-[#e6e9ef] text-[#323338]"
                              : "text-[#323338]/60 hover:bg-[#f6f7fb]"
                          }`}
                        >
                          By assignee
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                    {filteredAndSortedTasks.length === 0 ? (
                      <div className="rounded-lg border border-[#e6e9ef] bg-white py-10 text-center">
                        <p className="text-sm text-[#323338]/60">
                          No items match "{sortFilter === "me" ? "Me" : sortFilter === "wife" ? "Wife" : "Unassigned"}"
                        </p>
                        <button
                          type="button"
                          onClick={() => setSortFilter("all")}
                          className="mt-2 text-xs font-medium text-[#5034ff] hover:underline"
                        >
                          Show all
                        </button>
                      </div>
                    ) : (
                    filteredAndSortedTasks.map((task) => (
                      <div
                        key={task.id}
                        className="group flex items-center gap-4 rounded-lg border border-[#e6e9ef] bg-white px-4 py-3 shadow-sm transition hover:border-[#c5c7d0] hover:shadow"
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleTask(task)}
                          className="flex shrink-0 items-center gap-3 text-left"
                        >
                          {task.is_completed ? (
                            <CheckCircle2 className="h-5 w-5 text-[#00c875]" />
                          ) : (
                            <Circle className="h-5 w-5 text-[#c5c7d0]" />
                          )}
                          <span
                            className={`text-sm font-medium ${
                              task.is_completed
                                ? "text-[#323338]/50 line-through"
                                : "text-[#323338]"
                            }`}
                          >
                            {task.title}
                          </span>
                        </button>
                        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleAssignTask(task, "Rahul")}
                              className={`rounded px-2.5 py-1 text-xs font-medium ${
                                task.assigned_to === "Rahul"
                                  ? "bg-[#5034ff] text-white"
                                  : "bg-[#e6e9ef] text-[#323338] hover:bg-[#c5c7d0]"
                              }`}
                            >
                              Me
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAssignTask(task, "Wife")}
                              className={`rounded px-2.5 py-1 text-xs font-medium ${
                                task.assigned_to === "Wife"
                                  ? "bg-[#5034ff] text-white"
                                  : "bg-[#e6e9ef] text-[#323338] hover:bg-[#c5c7d0]"
                              }`}
                            >
                              Wife
                            </button>
                          </div>
                          <div className="flex items-center gap-2 text-[#323338]/50">
                            <span className="text-xs">
                              {creatorInitials(task.user_email)} · {task.assigned_to ?? "Unassigned"}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteTask(task)}
                              className="rounded p-1.5 text-[#323338]/50 transition hover:bg-rose-50 hover:text-rose-500"
                              aria-label="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                    )}
                  </div>
                  </>
                )}
              </>
            )}
          </div>
        </section>
      </main>

      {sessionEmail && isAllowed && householdId && selectedCategoryId ? (
        <form
          onSubmit={handleSubmit}
          className="fixed bottom-0 left-0 right-0 border-t border-[#e6e9ef] bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] md:left-64"
        >
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <input
              type="text"
              value={newTask}
              onChange={(event) => setNewTask(event.target.value)}
              placeholder="Add an item..."
              className="h-11 flex-1 rounded-lg border border-[#e6e9ef] bg-[#f6f7fb] px-4 text-sm text-[#323338] placeholder:text-[#323338]/50 focus:border-[#5034ff] focus:outline-none focus:ring-2 focus:ring-[#5034ff]/20"
            />
            <button
              type="submit"
              disabled={isSaving || !newTask.trim()}
              className="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-[#5034ff] px-5 text-sm font-semibold text-white transition hover:bg-[#4028e6] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
