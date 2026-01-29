"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Copy,
  LogIn,
  LogOut,
  Menu,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Task = {
  id: string;
  title: string;
  is_completed: boolean;
  assigned_to: string | null;
  household_id: string;
  user_email: string;
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

  const isAllowed = useMemo(() => {
    if (!sessionEmail) return false;
    return ALLOWED_EMAILS.includes(sessionEmail);
  }, [sessionEmail]);

  const inviteLink = useMemo(() => {
    if (!inviteCode) return null;
    return `family-task.app/join?code=${inviteCode}`;
  }, [inviteCode]);

  const displayNameFromEmail = (email: string) => {
    const namePart = email.split("@")[0] ?? "";
    if (!namePart) return email;
    return namePart
      .replace(/[._-]+/g, " ")
      .split(" ")
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(" ");
  };

  const loadTasks = useCallback(async (household: string) => {
    setIsLoadingTasks(true);
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("household_id", household)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Unable to load tasks: ${error.message}`);
      setIsLoadingTasks(false);
      return;
    }

    setTasks((data ?? []) as Task[]);
    setIsLoadingTasks(false);
  }, []);

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
      setMembers([]);
      setInviteCode(null);
      setHouseholdName(null);
      return;
    }

    loadHousehold(householdId);
    loadMembers(householdId);
    loadTasks(householdId);

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
          setTasks((current) => {
            const eventType = payload.eventType;
            if (eventType === "INSERT") {
              return [payload.new as Task, ...current];
            }
            if (eventType === "UPDATE") {
              return current.map((task) =>
                task.id === payload.new.id ? (payload.new as Task) : task,
              );
            }
            if (eventType === "DELETE") {
              return current.filter((task) => task.id !== payload.old.id);
            }
            return current;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, loadHousehold, loadMembers, loadTasks]);

  const handleGoogleSignIn = async () => {
    setMessage(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}`,
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
    setMembers([]);
    setInviteCode(null);
    setHouseholdName(null);
  };

  const handleAddTask = async () => {
    if (!sessionEmail || !householdId || !newTask.trim()) return;
    setIsSaving(true);
    setMessage(null);

    const { error } = await supabase.from("tasks").insert({
      title: newTask.trim(),
      user_email: sessionEmail,
      is_completed: false,
      household_id: householdId,
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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.25),_transparent_60%)]" />
      <main className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 pb-28 pt-8 md:flex-row">
        <div className="flex items-center justify-between md:hidden">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm"
          >
            <Menu className="h-4 w-4" />
            Menu
          </button>
          {sessionEmail && isAllowed ? (
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          ) : null}
        </div>

        <div
          className={`fixed inset-0 z-40 bg-slate-950/40 transition md:hidden ${
            isSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />

        <aside
          className={`fixed left-0 top-0 z-50 h-full w-72 transform bg-white p-6 shadow-xl transition md:static md:z-auto md:h-auto md:w-64 md:translate-x-0 md:rounded-3xl md:border md:border-slate-200 md:shadow-sm ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between md:hidden">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">
              Family
            </p>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-6 md:mt-0">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                Household
              </p>
              <div className="mt-2 flex items-center gap-2">
                <h2 className="text-xl font-semibold text-slate-900">
                  🏠 {householdName ?? "Our Home"}
                </h2>
                <button
                  type="button"
                  onClick={handleHouseholdNameEdit}
                  className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:text-slate-900"
                  aria-label="Edit household name"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              {isEditingHouseholdName ? (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="text"
                    value={householdNameDraft}
                    onChange={(event) =>
                      setHouseholdNameDraft(event.target.value)
                    }
                    placeholder="Update household name"
                    className="h-9 flex-1 rounded-full border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                  <button
                    type="button"
                    onClick={handleHouseholdNameSave}
                    className="rounded-full border border-slate-200 bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingHouseholdName(false)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:text-slate-900"
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
              {sessionEmail ? (
                <p className="mt-2 text-sm text-slate-500">{sessionEmail}</p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                Members
              </p>
              <div className="mt-3 flex flex-col gap-2 text-sm text-slate-700">
                {members.length === 0 ? (
                  <p className="text-sm text-slate-500">No members yet.</p>
                ) : (
                  members.map((member) => (
                    <span
                      key={`${member.email ?? "member"}-${
                        member.full_name ?? "name"
                      }`}
                    >
                      {member.full_name ||
                        (member.email
                          ? displayNameFromEmail(member.email)
                          : "Member")}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                Invite Link
              </p>
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <span className="flex-1 truncate">
                  {inviteLink ?? "Invite link not ready"}
                </span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  disabled={!inviteLink}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:text-slate-900 disabled:cursor-not-allowed"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </button>
              </div>
              {isJoining ? (
                <p className="mt-2 text-xs text-slate-400">
                  Joining household...
                </p>
              ) : null}
            </div>
          </div>
        </aside>

        <section className="flex min-h-screen flex-1 flex-col gap-6">
          <header className="flex flex-col gap-6">
            <div className="hidden items-start justify-between gap-4 md:flex">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">
                  Family
                </p>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
                  Shared Tasks
                </h1>
              </div>
              {sessionEmail && isAllowed ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 text-slate-700">
                <Sparkles className="h-5 w-5 text-slate-400" />
                <p className="text-sm font-medium">
                  Everything updates instantly between your devices.
                </p>
              </div>
              {message ? (
                <p className="mt-3 text-sm text-rose-500">{message}</p>
              ) : null}
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-4">
            {isInitializing ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-slate-500">Loading your space...</p>
              </div>
            ) : !sessionEmail || !isAllowed ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
                <p className="text-base font-medium text-slate-700">
                  Sign in to see your shared list.
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Only approved family emails can access this space.
                </p>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800"
                >
                  <LogIn className="h-4 w-4" />
                  Sign in with Google
                </button>
              </div>
            ) : !householdId ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                <p className="text-sm text-slate-500">
                  Join a household to see shared tasks.
                </p>
              </div>
            ) : isLoadingTasks ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-slate-500">Loading tasks...</p>
              </div>
            ) : tasks.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                <p className="text-sm text-slate-500">
                  No tasks yet. Add one below!
                </p>
              </div>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
                >
                  <div className="flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => handleToggleTask(task)}
                      className="flex items-center gap-3 text-left"
                    >
                      {task.is_completed ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <Circle className="h-5 w-5 text-slate-400" />
                      )}
                      <span
                        className={`text-sm font-medium ${
                          task.is_completed
                            ? "text-slate-400 line-through"
                            : "text-slate-900"
                        }`}
                      >
                        {task.title}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTask(task)}
                      className="rounded-full p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
                      aria-label="Delete task"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                        {creatorInitials(task.user_email)}
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-slate-600">
                          Created by {creatorLabel(task.user_email)}
                        </p>
                        <p className="text-xs text-slate-400">
                          Assigned to {task.assigned_to ?? "Unassigned"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAssignTask(task, "Rahul")}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                          task.assigned_to === "Rahul"
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        Assign to me
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAssignTask(task, "Wife")}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                          task.assigned_to === "Wife"
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        Assign to Wife
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {sessionEmail && isAllowed && householdId ? (
        <form
          onSubmit={handleSubmit}
          className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur"
        >
          <div className="mx-auto flex w-full max-w-2xl items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-lg shadow-slate-900/5">
            <input
              type="text"
              value={newTask}
              onChange={(event) => setNewTask(event.target.value)}
              placeholder="Add a new task..."
              className="h-10 flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isSaving || !newTask.trim()}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
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
