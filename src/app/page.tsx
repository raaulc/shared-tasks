"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Copy,
  FolderPlus,
  Home as HomeIcon,
  Link2,
  List,
  LogIn,
  LogOut,
  Menu,
  Pencil,
  Plus,
  Settings,
  Sparkles,
  Trash2,
  Users,
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
  id: string;
  email: string | null;
  full_name: string | null;
  color: string | null;
};

type Workspace = {
  id: string;
  name: string;
};

const DEFAULT_MEMBER_COLORS = [
  "#8a9a5b", "#00c875", "#fdab3d", "#e44258", "#579bfc",
  "#6b7b4b", "#9ab06d", "#f9d648", "#7a8f5a", "#a25ddc",
];

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
  const [deleteTask, setDeleteTask] = useState<Task | null>(null);
  const [deleteMember, setDeleteMember] = useState<Member | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState("");
  const [setHomeStep, setSetHomeStep] = useState<"choose" | "join" | "create">("choose");
  const [joinLinkInput, setJoinLinkInput] = useState("");
  const [newHomeName, setNewHomeName] = useState("");
  const [showShareLink, setShowShareLink] = useState(false);
  const [sortFilter, setSortFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"date" | "assignment">("date");
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [joinWorkspaceInput, setJoinWorkspaceInput] = useState("");
  const deleteBroadcastRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const displayNameFromEmail = (email: string) => {
    const namePart = email.split("@")[0] ?? "";
    if (!namePart) return email;
    return namePart
      .replace(/[._-]+/g, " ")
      .split(" ")
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(" ");
  };

  const assigneeValueForMember = useCallback((m: Member) => {
    return m.full_name || (m.email ? displayNameFromEmail(m.email) : "Unknown");
  }, []);

  const getColorForMember = useCallback((m: Member, index: number) => {
    if (m.color) return m.color;
    return DEFAULT_MEMBER_COLORS[index % DEFAULT_MEMBER_COLORS.length];
  }, []);

  const getColorForAssignee = useCallback(
    (assigneeValue: string | null) => {
      const idx = members.findIndex((m) => assigneeValueForMember(m) === assigneeValue);
      if (idx >= 0) return getColorForMember(members[idx], idx);
      return "#8a9a6b";
    },
    [members, assigneeValueForMember, getColorForMember],
  );

  const isAllowed = useMemo(() => !!sessionEmail, [sessionEmail]);

  const [appOrigin, setAppOrigin] = useState("");

  useEffect(() => {
    setAppOrigin(
      process.env.NEXT_PUBLIC_APP_URL ||
        (typeof window !== "undefined" ? window.location.origin : ""),
    );
  }, []);

  const inviteLink = useMemo(() => {
    if (!inviteCode || !appOrigin) return null;
    const base = appOrigin.replace(/\/$/, "");
    return `${base}/join?code=${inviteCode}`;
  }, [inviteCode, appOrigin]);

  const filteredAndSortedTasks = useMemo(() => {
    let list = [...tasks];
    if (sortFilter && sortFilter !== "all") {
      if (sortFilter === "unassigned") {
        list = list.filter((t) => !t.assigned_to || t.assigned_to === "Unassigned");
      } else {
        list = list.filter((t) => t.assigned_to === sortFilter);
      }
    }
    if (sortOrder === "assignment") {
      list.sort((a, b) => {
        const aVal = a.assigned_to ?? "zzz";
        const bVal = b.assigned_to ?? "zzz";
        return aVal.localeCompare(bVal);
      });
    }
    return list;
  }, [tasks, sortFilter, sortOrder]);

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

  const generateInviteCode = () =>
    Math.random().toString(36).slice(2, 10);

  const createHousehold = useCallback(
    async (profileId: string, name: string) => {
      const inviteCode = generateInviteCode();
      const { data: household, error: householdError } = await supabase
        .from("households")
        .insert({ name: name.trim() || "Our Home", invite_code: inviteCode })
        .select("id, invite_code")
        .single();

      if (householdError || !household?.id) {
        setMessage(
          `Unable to create home: ${householdError?.message ?? "Unknown error."}`,
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

      await supabase.from("household_members").upsert(
        { profile_id: profileId, household_id: household.id },
        { onConflict: "profile_id,household_id" },
      );

      setHouseholdId(household.id);
      setInviteCode(household.invite_code ?? inviteCode);
      setHouseholdName(name.trim() || "Our Home");
      setWorkspaces((prev) => {
        const exists = prev.some((w) => w.id === household.id);
        if (exists) return prev;
        return [...prev, { id: household.id, name: name.trim() || "Our Home" }];
      });
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

            setUserId(profileId);
            return;
          }

          if (!fallbackData.household_id) {
            setUserId(profileId);
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

        return;
      }

      if (!data.full_name && resolvedName) {
        await supabase
          .from("profiles")
          .update({ full_name: resolvedName })
          .eq("id", profileId);
      }

      if (!data.household_id) {
        return;
      }

      setHouseholdId(data.household_id);
    },
    [],
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
      .select("id, email, full_name, color")
      .eq("household_id", household)
      .order("full_name", { ascending: true });

    if (error) {
      if (error.message.includes("does not exist")) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("profiles")
          .select("id, email")
          .eq("household_id", household)
          .order("email", { ascending: true });

        if (fallbackError) {
          setMessage(`Unable to load members: ${fallbackError.message}`);
          return;
        }

        setMembers((fallbackData ?? []).map((item) => ({
          id: item.id,
          email: item.email ?? null,
          full_name: null,
          color: null,
        })));
        return;
      }

      setMessage(`Unable to load members: ${error.message}`);
      return;
    }

    setMembers((data ?? []).map((r) => ({
      id: r.id,
      email: r.email ?? null,
      full_name: r.full_name ?? null,
      color: r.color ?? null,
    })));
  }, []);

  const loadUserWorkspaces = useCallback(async (profileId: string) => {
    const { data: memberships, error: memError } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("profile_id", profileId);

    if (memError) {
      if (memError.message.includes("does not exist")) return;
      setMessage(`Unable to load workspaces: ${memError.message}`);
      return;
    }

    const ids = (memberships ?? []).map((m) => m.household_id);
    if (ids.length === 0) {
      setWorkspaces([]);
      return;
    }

    const { data: houses, error: houseError } = await supabase
      .from("households")
      .select("id, name")
      .in("id", ids);

    if (houseError) {
      setWorkspaces(ids.map((id) => ({ id, name: "Our Home" })));
      return;
    }

    const byId = new Map((houses ?? []).map((h) => [h.id, h.name ?? "Our Home"]));
    setWorkspaces(ids.map((id) => ({ id, name: byId.get(id) ?? "Our Home" })));
  }, []);

  const extractInviteCode = useCallback((input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("http") || trimmed.includes("?") || trimmed.includes("=")) {
      try {
        const url = new URL(trimmed.startsWith("http") ? trimmed : `https://x/?${trimmed}`);
        return url.searchParams.get("code");
      } catch {
        return null;
      }
    }
    return trimmed;
  }, []);

  const joinHousehold = useCallback(
    async (code: string, profileId: string) => {
      setIsJoining(true);
      setMessage(null);

      const { data, error } = await supabase
        .from("households")
        .select("id, invite_code, name")
        .eq("invite_code", code)
        .single();

      if (error || !data?.id) {
        setMessage("That invite code is not valid.");
        setIsJoining(false);
        return;
      }

      const { error: memberError } = await supabase
        .from("household_members")
        .upsert(
          { profile_id: profileId, household_id: data.id },
          { onConflict: "profile_id,household_id" },
        );

      if (memberError) {
        setMessage(`Unable to join workspace: ${memberError.message}`);
        setIsJoining(false);
        return;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ household_id: data.id })
        .eq("id", profileId);

      if (updateError) {
        setMessage(`Unable to switch workspace: ${updateError.message}`);
        setIsJoining(false);
        return;
      }

      setHouseholdId(data.id);
      setInviteCode(data.invite_code ?? null);
      setHouseholdName(data.name ?? "Our Home");
      setWorkspaces((prev) => {
        const exists = prev.some((w) => w.id === data.id);
        if (exists) return prev;
        return [...prev, { id: data.id, name: data.name ?? "Our Home" }];
      });
      window.history.replaceState({}, "", window.location.pathname);
      setMessage("Joined workspace successfully.");
      setIsJoining(false);
    },
    [],
  );

  const handleJoinWithLink = useCallback(async () => {
    const code = extractInviteCode(joinLinkInput);
    if (!code || !userId) {
      setMessage("Paste a valid invite link or code.");
      return;
    }
    await joinHousehold(code, userId);
    setJoinLinkInput("");
    setSetHomeStep("choose");
  }, [extractInviteCode, joinHousehold, joinLinkInput, userId]);

  const handleCreateHome = useCallback(async () => {
    if (!userId) return;
    await createHousehold(userId, newHomeName || "Our Home");
    setNewHomeName("");
    setSetHomeStep("choose");
    setShowShareLink(true);
  }, [createHousehold, newHomeName, userId]);

  const handleSwitchWorkspace = useCallback(
    async (workspace: Workspace) => {
      if (!userId || workspace.id === householdId) return;
      const { error } = await supabase
        .from("profiles")
        .update({ household_id: workspace.id })
        .eq("id", userId);

      if (error) {
        setMessage(`Unable to switch: ${error.message}`);
        return;
      }

      setHouseholdId(workspace.id);
      setHouseholdName(workspace.name);
      setInviteCode(null);
      setCategories([]);
      setSelectedCategoryId(null);
      setTasks([]);
      setMembers([]);
      setIsSettingsOpen(false);
    },
    [householdId, userId],
  );

  const handleJoinFromSettings = useCallback(async () => {
    const code = extractInviteCode(joinWorkspaceInput);
    if (!code || !userId) {
      setMessage("Paste a valid invite link or code.");
      return;
    }
    await joinHousehold(code, userId);
    setJoinWorkspaceInput("");
  }, [extractInviteCode, joinHousehold, joinWorkspaceInput, userId]);

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

    setMessage(null);
    loadProfile(userId, sessionEmail, userFullName);
    loadUserWorkspaces(userId);
  }, [loadProfile, loadUserWorkspaces, sessionEmail, userFullName, userId]);

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
    if (!householdId || categories.length === 0) return;
    if (selectedCategoryId) return;
    const stored = localStorage.getItem(`olivelist:board:${householdId}`);
    if (stored && categories.some((c) => c.id === stored)) {
      setSelectedCategoryId(stored);
    }
  }, [householdId, categories, selectedCategoryId]);

  useEffect(() => {
    if (!householdId || !selectedCategoryId) return;
    localStorage.setItem(`olivelist:board:${householdId}`, selectedCategoryId);
  }, [householdId, selectedCategoryId]);

  useEffect(() => {
    if (!householdId) return;

    loadTasks(householdId, selectedCategoryId);

    const postgresChannel = supabase
      .channel("tasks-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
        },
        (payload) => {
          const eventType = payload.eventType;
          const newRecord = payload.new as Task | undefined;

          if (eventType === "INSERT") {
            if (newRecord?.household_id !== householdId) return;
            if (selectedCategoryId && newRecord.category_id !== selectedCategoryId) return;
            setTasks((current) => [newRecord, ...current]);
            return;
          }
          if (eventType === "UPDATE") {
            if (newRecord?.household_id !== householdId) return;
            setTasks((current) => {
              if (selectedCategoryId && newRecord.category_id !== selectedCategoryId) {
                return current.filter((t) => t.id !== newRecord.id);
              }
              return current.map((t) => (t.id === newRecord.id ? newRecord : t));
            });
            return;
          }
          if (eventType === "DELETE") {
            const oldData = (payload.old ?? (payload as { oldRecord?: unknown }).oldRecord) as Record<string, unknown> | undefined;
            const deletedId = (oldData?.id ?? (oldData?.record as Record<string, unknown>)?.id) as string | undefined;
            if (deletedId) {
              setTasks((current) => current.filter((t) => t.id !== deletedId));
            }
          }
        },
      )
      .subscribe();

    const broadcastChannel = supabase
      .channel(`household:${householdId}:tasks`)
      .on("broadcast", { event: "task-deleted" }, (payload) => {
        const taskId = (payload.payload as { taskId?: string })?.taskId;
        if (taskId) {
          setTasks((current) => current.filter((t) => t.id !== taskId));
        }
      })
      .subscribe();

    deleteBroadcastRef.current = broadcastChannel;

    return () => {
      deleteBroadcastRef.current = null;
      supabase.removeChannel(postgresChannel);
      supabase.removeChannel(broadcastChannel);
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
      return;
    }

    deleteBroadcastRef.current?.send({
      type: "broadcast",
      event: "task-deleted",
      payload: { taskId: task.id },
    });
  };

  const handleUpdateTask = async (taskId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const previousTitle = tasks.find((t) => t.id === taskId)?.title ?? "";
    setMessage(null);
    setTasks((current) =>
      current.map((item) =>
        item.id === taskId ? { ...item, title: trimmed } : item,
      ),
    );
    setEditingTaskId(null);
    setEditingTaskTitle("");

    const { error } = await supabase
      .from("tasks")
      .update({ title: trimmed })
      .eq("id", taskId);

    if (error) {
      setMessage(`Unable to update task: ${error.message}`);
      setTasks((current) =>
        current.map((item) =>
          item.id === taskId ? { ...item, title: previousTitle } : item,
        ),
      );
      setEditingTaskId(taskId);
      setEditingTaskTitle(trimmed);
    }
  };

  const handleAssignTask = async (task: Task, assignee: string | null) => {
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

  const getInitialsForEmail = useCallback(
    (email: string) => {
      const m = members.find((x) => x.email === email);
      if (m?.full_name) {
        const initials = m.full_name
          .split(/\s+/)
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
        return initials || "?";
      }
      const name = displayNameFromEmail(email);
      return name ? name[0].toUpperCase() : "?";
    },
    [members],
  );

  const handleUpdateMemberColor = async (memberId: string, color: string) => {
    if (!userId || memberId !== userId) return;
    setMessage(null);
    const { error } = await supabase
      .from("profiles")
      .update({ color })
      .eq("id", memberId);

    if (error) {
      setMessage(`Unable to update color: ${error.message}`);
      return;
    }
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, color } : m)),
    );
    setMessage("Color updated.");
    setTimeout(() => setMessage(null), 2000);
  };

  const handleRemoveMember = useCallback(
    async (member: Member) => {
      if (!householdId) return;
      const assigneeValue = assigneeValueForMember(member);
      const isSelf = member.id === userId;

      const { error: deleteError } = await supabase
        .from("household_members")
        .delete()
        .eq("profile_id", member.id)
        .eq("household_id", householdId);

      if (deleteError) {
        setMessage(`Unable to remove member: ${deleteError.message}`);
        return;
      }

      const { data: remaining } = await supabase
        .from("household_members")
        .select("household_id")
        .eq("profile_id", member.id)
        .limit(1);

      const newHouseholdId = remaining?.[0]?.household_id ?? null;
      await supabase
        .from("profiles")
        .update({ household_id: newHouseholdId })
        .eq("id", member.id);

      const { error: taskError } = await supabase
        .from("tasks")
        .update({ assigned_to: null })
        .eq("household_id", householdId)
        .eq("assigned_to", assigneeValue);

      if (taskError) {
        setMessage(`Member removed, but some task updates failed.`);
      }

      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      setTasks((prev) =>
        prev.map((t) =>
          t.assigned_to === assigneeValue ? { ...t, assigned_to: null } : t,
        ),
      );
      setWorkspaces((prev) => prev.filter((w) => w.id !== householdId || !isSelf));

      if (isSelf) {
        setHouseholdId(newHouseholdId);
        setInviteCode(null);
        setIsSettingsOpen(false);
        if (newHouseholdId) {
          loadHousehold(newHouseholdId);
          loadMembers(newHouseholdId);
          loadCategories(newHouseholdId);
        } else {
          setCategories([]);
          setTasks([]);
        }
      }

      setDeleteMember(null);
      setMessage(isSelf ? "You left the workspace." : "Member removed.");
      setTimeout(() => setMessage(null), 2000);
    },
    [assigneeValueForMember, householdId, loadCategories, loadHousehold, loadMembers, userId],
  );

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

  const handleSendInvite = async () => {
    const email = inviteEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteError("Please enter a valid email address.");
      return;
    }
    setInviteError(null);
    setIsInviting(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setInviteError("Please sign in again and retry.");
        return;
      }
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) {
        setInviteError(json.error ?? "Failed to send invite.");
        return;
      }
      setInviteEmail("");
      setMessage("Invite sent!");
      setTimeout(() => setMessage(null), 2000);
    } catch {
      setInviteError("Something went wrong. Please try again.");
    } finally {
      setIsInviting(false);
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

  if (!sessionEmail || !isAllowed) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#f0f2ed] via-white to-[#f8f9f6] text-[#323338]">
        <div className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 py-16">
          <div className="text-center">
            <div className="mb-6 inline-flex items-center justify-center rounded-2xl bg-[#8a9a5b]/10 p-4">
              <List className="h-12 w-12 text-[#8a9a5b]" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-[#323338] sm:text-5xl">
              Olivelist
            </h1>
            <p className="mt-4 text-xl text-[#323338]/70 sm:text-2xl">
              Shared lists for families. Keep everyone in sync.
            </p>
            <p className="mt-6 max-w-xl text-[#323338]/60">
              Create boards, assign tasks, and get things done together. Real-time updates across all your devices.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
              <div className="flex items-center gap-2 text-sm text-[#323338]/60">
                <CheckCircle2 className="h-5 w-5 text-[#00c875]" />
                Real-time sync
              </div>
              <div className="flex items-center gap-2 text-sm text-[#323338]/60">
                <Users className="h-5 w-5 text-[#8a9a5b]" />
                Assign to family
              </div>
              <div className="flex items-center gap-2 text-sm text-[#323338]/60">
                <Copy className="h-5 w-5 text-[#8a9a5b]" />
                Invite by link
              </div>
            </div>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isInitializing}
              className="mt-12 inline-flex items-center gap-3 rounded-xl bg-[#8a9a5b] px-8 py-4 text-base font-semibold text-white shadow-lg shadow-[#8a9a5b]/25 transition hover:bg-[#6b7b4b] hover:shadow-[#8a9a5b]/30 disabled:opacity-70"
            >
              <LogIn className="h-6 w-6" />
              {isInitializing ? "Loading…" : "Sign in with Google"}
            </button>
            <p className="mt-6 text-xs text-[#323338]/50">
              Use your family email to get started
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9f6] text-[#323338]">
      <main className="relative flex min-h-screen w-full flex-col pb-24 md:flex-row">
        <div className="flex items-center justify-between border-b border-[#e2e6e3] bg-white px-4 py-3 md:hidden">
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
          className={`fixed left-0 top-0 z-50 h-full w-64 transform bg-[#3d4a47] p-5 transition md:static md:z-auto md:h-auto md:translate-x-0 ${
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
                    className="rounded-lg border-0 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:ring-2 focus:ring-[#8a9a5b]"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleHouseholdNameSave}
                      className="rounded-lg bg-[#8a9a5b] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#6b7b4b]"
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
                  members.map((member, idx) => (
                    <span
                      key={member.id}
                      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-white shadow-sm"
                      style={{
                        backgroundColor: getColorForMember(member, idx),
                      }}
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
                          ? "bg-[#8a9a5b]"
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
                      className="w-full min-w-0 rounded-lg border-0 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:ring-2 focus:ring-[#8a9a5b]"
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
          <div className="flex items-center justify-between border-b border-[#e2e6e3] pb-4">
            <h2 className="text-lg font-semibold text-[#323338]">Settings</h2>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className="rounded-lg p-2 text-[#323338]/60 hover:bg-[#f8f9f6]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-6 flex flex-col gap-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#323338]/50">
                Workspaces
              </p>
              {workspaces.length > 0 ? (
                <div className="mt-2 flex flex-col gap-1.5">
                  {workspaces.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => handleSwitchWorkspace(w)}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                        w.id === householdId
                          ? "border-[#8a9a5b] bg-[#8a9a5b]/10 text-[#323338]"
                          : "border-[#e2e6e3] bg-[#f8f9f6] text-[#323338]/80 hover:border-[#8a9a5b]/50"
                      }`}
                    >
                      <span className="font-medium">{w.name}</span>
                      {w.id === householdId && (
                        <span className="text-xs text-[#8a9a5b]">Current</span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-[#323338]/50">No workspaces yet</p>
              )}
              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#323338]/50">
                  Join another workspace
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={joinWorkspaceInput}
                    onChange={(e) => {
                      setJoinWorkspaceInput(e.target.value);
                      setMessage(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleJoinFromSettings()}
                    placeholder="Paste invite link or code"
                    className="flex-1 rounded-lg border border-[#e2e6e3] bg-white px-3 py-2 text-sm text-[#323338] placeholder:text-[#323338]/50 focus:border-[#8a9a5b] focus:outline-none focus:ring-1 focus:ring-[#8a9a5b]"
                  />
                  <button
                    type="button"
                    onClick={handleJoinFromSettings}
                    disabled={isJoining || !joinWorkspaceInput.trim()}
                    className="shrink-0 rounded-lg bg-[#8a9a5b] px-3 py-2 text-sm font-semibold text-white hover:bg-[#6b7b4b] disabled:opacity-50"
                  >
                    {isJoining ? "Joining…" : "Join"}
                  </button>
                </div>
                {isJoining && (
                  <p className="mt-2 text-xs text-[#323338]/50">Joining workspace...</p>
                )}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#323338]/50">
                Invite to workspace
              </p>
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-[#e2e6e3] bg-[#f8f9f6] px-3 py-2.5">
                <span className="flex-1 truncate text-sm text-[#323338]">
                  {inviteLink ?? "Invite link not ready"}
                </span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  disabled={!inviteLink}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#8a9a5b] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#6b7b4b] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="email"
                  placeholder="Email address"
                  value={inviteEmail}
                  onChange={(e) => {
                    setInviteEmail(e.target.value);
                    setInviteError(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleSendInvite()}
                  className="flex-1 rounded-lg border border-[#e2e6e3] bg-white px-3 py-2 text-sm text-[#323338] placeholder:text-[#323338]/50 focus:border-[#8a9a5b] focus:outline-none focus:ring-1 focus:ring-[#8a9a5b]"
                />
                <button
                  type="button"
                  onClick={handleSendInvite}
                  disabled={isInviting || !inviteEmail.trim()}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#8a9a5b] px-3 py-2 text-xs font-semibold text-white hover:bg-[#6b7b4b] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isInviting ? "Sending…" : "Send invite"}
                </button>
              </div>
              {inviteError ? (
                <p className="mt-2 text-xs text-rose-600">{inviteError}</p>
              ) : null}
              {isJoining ? (
                <p className="mt-2 text-xs text-[#323338]/50">Joining workspace...</p>
              ) : null}
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#323338]/50">
                Member colors
              </p>
              <div className="mt-2 flex flex-col gap-3">
                {members.map((m, idx) => {
                  const val = assigneeValueForMember(m);
                  const color = getColorForMember(m, idx);
                  const isCurrentUser = m.email === sessionEmail;
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-[#e2e6e3] bg-[#f8f9f6] px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="h-6 w-6 shrink-0 rounded-full ring-2 ring-white shadow-sm"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-sm font-medium text-[#323338]">
                          {val}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {isCurrentUser && (
                          <input
                            type="color"
                            value={color}
                            onChange={(e) =>
                              handleUpdateMemberColor(m.id, e.target.value)
                            }
                            className="h-8 w-12 cursor-pointer rounded border-0 bg-transparent p-0"
                            title="Change your color"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => setDeleteMember(m)}
                          className="rounded p-1.5 text-[#323338]/50 transition hover:bg-rose-100 hover:text-rose-600"
                          aria-label={`Remove ${val}`}
                          title={`Remove ${val}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {members.length === 0 ? (
                  <p className="text-xs text-[#323338]/50">No members yet</p>
                ) : null}
              </div>
            </div>
          </div>
        </aside>

        {/* Delete task confirmation modal */}
        {deleteTask ? (
          <>
            <div
              className="fixed inset-0 z-[60] bg-black/50"
              onClick={() => setDeleteTask(null)}
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
                    Delete item?
                  </h3>
                  <p className="mt-1 text-sm text-[#323338]/60">
                    "{deleteTask.title}" will be permanently deleted.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteTask(null)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-[#323338] hover:bg-[#f8f9f6]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteTask(deleteTask);
                    setDeleteTask(null);
                  }}
                  className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600"
                >
                  Delete
                </button>
              </div>
            </div>
          </>
        ) : null}

        {/* Remove member confirmation modal */}
        {deleteMember ? (
          <>
            <div
              className="fixed inset-0 z-[60] bg-black/50"
              onClick={() => setDeleteMember(null)}
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
                    Remove member?
                  </h3>
                  <p className="mt-1 text-sm text-[#323338]/60">
                    {deleteMember.id === userId
                      ? "You will leave this household. Tasks assigned to you will be unassigned."
                      : `${assigneeValueForMember(deleteMember)} will be removed. Tasks assigned to them will be unassigned.`}
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteMember(null)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-[#323338] hover:bg-[#f8f9f6]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveMember(deleteMember)}
                  className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600"
                >
                  Remove
                </button>
              </div>
            </div>
          </>
        ) : null}

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
                  className="rounded-lg px-4 py-2 text-sm font-medium text-[#323338] hover:bg-[#f8f9f6]"
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

        <section className="flex min-h-screen flex-1 flex-col bg-[#f8f9f6]">
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#e2e6e3] bg-white px-6 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-[#323338]">
                {categories.find((c) => c.id === selectedCategoryId)?.name ?? "Shared Lists"}
              </h1>
              {selectedCategoryId && (
                <span className="rounded-md bg-[#8a9a5b]/15 px-2.5 py-1 text-xs font-semibold text-[#6b7b4b]">
                  Live
                </span>
              )}
            </div>
            {sessionEmail && isAllowed ? (
              <div className="hidden items-center gap-2 md:flex">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[#323338] hover:bg-[#f8f9f6]"
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

          {householdId && showShareLink && inviteLink ? (
            <div className="mx-6 mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-[#8a9a5b]/30 bg-[#8a9a5b]/5 px-4 py-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Link2 className="h-5 w-5 shrink-0 text-[#8a9a5b]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#323338]">Share this link to invite family</p>
                  <p className="mt-0.5 truncate text-xs text-[#323338]/70">{inviteLink}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#8a9a5b] px-3 py-2 text-xs font-semibold text-white hover:bg-[#6b7b4b]"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy link
                </button>
                <button
                  type="button"
                  onClick={() => setShowShareLink(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-[#323338]/70 hover:bg-[#e2e6e3]"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-1 flex-col p-6">
            {isInitializing ? (
              <div className="rounded-lg bg-white p-8 shadow-sm">
                <p className="text-sm text-[#323338]/60">Loading your workspace...</p>
              </div>
            ) : !sessionEmail || !isAllowed ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#e2e6e3] bg-white px-8 py-16 text-center">
                <p className="text-lg font-medium text-[#323338]">Welcome to Olivelist</p>
                <p className="mt-2 text-sm text-[#323338]/60">
                  Sign in with your family email to start sharing lists
                </p>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[#8a9a5b] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#6b7b4b]"
                >
                  <LogIn className="h-4 w-4" />
                  Sign in with Google
                </button>
              </div>
            ) : !householdId ? (
              <div className="mx-auto flex max-w-md flex-col gap-6 rounded-xl border border-[#e2e6e3] bg-white p-8 shadow-sm">
                <div className="text-center">
                  <div className="mx-auto mb-4 inline-flex items-center justify-center rounded-2xl bg-[#8a9a5b]/10 p-3">
                    <HomeIcon className="h-10 w-10 text-[#8a9a5b]" />
                  </div>
                  <h2 className="text-xl font-semibold text-[#323338]">
                    Set up your home
                  </h2>
                  <p className="mt-2 text-sm text-[#323338]/60">
                    Join an existing home or create a new one to get started
                  </p>
                </div>

                {setHomeStep === "choose" ? (
                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => setSetHomeStep("join")}
                      className="flex items-center gap-3 rounded-xl border border-[#e2e6e3] bg-[#f8f9f6] px-4 py-4 text-left transition hover:border-[#8a9a5b] hover:bg-[#8a9a5b]/5"
                    >
                      <Link2 className="h-5 w-5 shrink-0 text-[#8a9a5b]" />
                      <span className="font-medium text-[#323338]">Join a home</span>
                      <span className="text-sm text-[#323338]/50">Paste an invite link</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSetHomeStep("create")}
                      className="flex items-center gap-3 rounded-xl border border-[#e2e6e3] bg-[#f8f9f6] px-4 py-4 text-left transition hover:border-[#8a9a5b] hover:bg-[#8a9a5b]/5"
                    >
                      <HomeIcon className="h-5 w-5 shrink-0 text-[#8a9a5b]" />
                      <span className="font-medium text-[#323338]">Create a new home</span>
                      <span className="text-sm text-[#323338]/50">Start from scratch</span>
                    </button>
                  </div>
                ) : setHomeStep === "join" ? (
                  <div className="flex flex-col gap-4">
                    <button
                      type="button"
                      onClick={() => setSetHomeStep("choose")}
                      className="self-start text-sm font-medium text-[#8a9a5b] hover:underline"
                    >
                      ← Back
                    </button>
                    <div>
                      <label htmlFor="join-link" className="block text-sm font-medium text-[#323338]">
                        Paste invite link or code
                      </label>
                      <input
                        id="join-link"
                        type="text"
                        value={joinLinkInput}
                        onChange={(e) => {
                          setJoinLinkInput(e.target.value);
                          setMessage(null);
                        }}
                        placeholder="https://.../join?code=xxx or paste code"
                        className="mt-2 w-full rounded-lg border border-[#e2e6e3] bg-white px-4 py-3 text-sm text-[#323338] placeholder:text-[#323338]/50 focus:border-[#8a9a5b] focus:outline-none focus:ring-2 focus:ring-[#8a9a5b]/20"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleJoinWithLink}
                      disabled={isJoining || !joinLinkInput.trim()}
                      className="rounded-lg bg-[#8a9a5b] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#6b7b4b] disabled:opacity-50"
                    >
                      {isJoining ? "Joining…" : "Join home"}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <button
                      type="button"
                      onClick={() => setSetHomeStep("choose")}
                      className="self-start text-sm font-medium text-[#8a9a5b] hover:underline"
                    >
                      ← Back
                    </button>
                    <div>
                      <label htmlFor="home-name" className="block text-sm font-medium text-[#323338]">
                        Home name
                      </label>
                      <input
                        id="home-name"
                        type="text"
                        value={newHomeName}
                        onChange={(e) => {
                          setNewHomeName(e.target.value);
                          setMessage(null);
                        }}
                        placeholder="e.g. Smith Family, Our Home"
                        className="mt-2 w-full rounded-lg border border-[#e2e6e3] bg-white px-4 py-3 text-sm text-[#323338] placeholder:text-[#323338]/50 focus:border-[#8a9a5b] focus:outline-none focus:ring-2 focus:ring-[#8a9a5b]/20"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleCreateHome}
                      disabled={!newHomeName.trim()}
                      className="rounded-lg bg-[#8a9a5b] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#6b7b4b] disabled:opacity-50"
                    >
                      Create home
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {!selectedCategoryId ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#e2e6e3] bg-white py-20 text-center">
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
                  <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#e2e6e3] bg-white py-16 text-center">
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
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <label htmlFor="filter-assignee" className="text-xs font-medium text-[#323338]/60">
                          Assigned to
                        </label>
                        <select
                          id="filter-assignee"
                          value={sortFilter}
                          onChange={(e) => setSortFilter(e.target.value)}
                          className="rounded-lg border border-[#e2e6e3] bg-white px-3 py-2 text-sm text-[#323338] focus:border-[#8a9a5b] focus:outline-none focus:ring-2 focus:ring-[#8a9a5b]/20"
                        >
                          <option value="all">All</option>
                          {members.map((m) => {
                            const val = assigneeValueForMember(m);
                            return (
                              <option key={m.id} value={val}>
                                {val}
                              </option>
                            );
                          })}
                          <option value="unassigned">Unassigned</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <label htmlFor="sort-order" className="text-xs font-medium text-[#323338]/60">
                          Sort by
                        </label>
                        <select
                          id="sort-order"
                          value={sortOrder}
                          onChange={(e) =>
                            setSortOrder(e.target.value as "date" | "assignment")
                          }
                          className="rounded-lg border border-[#e2e6e3] bg-white px-3 py-2 text-sm text-[#323338] focus:border-[#8a9a5b] focus:outline-none focus:ring-2 focus:ring-[#8a9a5b]/20"
                        >
                          <option value="date">Newest first</option>
                          <option value="assignment">By assignee</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                    {filteredAndSortedTasks.length === 0 ? (
                      <div className="rounded-lg border border-[#e2e6e3] bg-white py-10 text-center">
                        <p className="text-sm text-[#323338]/60">
                          No items match "{sortFilter === "unassigned" ? "Unassigned" : sortFilter}"
                        </p>
                        <button
                          type="button"
                          onClick={() => setSortFilter("all")}
                          className="mt-2 text-xs font-medium text-[#8a9a5b] hover:underline"
                        >
                          Show all
                        </button>
                      </div>
                    ) : (
                    filteredAndSortedTasks.map((task) => (
                      <div
                        key={task.id}
                        className="group flex items-center gap-4 rounded-xl border border-[#e2e6e3] bg-white px-4 py-3 shadow-sm transition hover:border-[#c5cac6] hover:shadow-md"
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
                          {editingTaskId === task.id ? (
                            <input
                              type="text"
                              value={editingTaskTitle}
                              onChange={(e) => setEditingTaskTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleUpdateTask(task.id, editingTaskTitle);
                                }
                                if (e.key === "Escape") {
                                  setEditingTaskId(null);
                                  setEditingTaskTitle("");
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              onBlur={() => {
                                if (editingTaskTitle.trim()) {
                                  handleUpdateTask(task.id, editingTaskTitle);
                                } else {
                                  setEditingTaskId(null);
                                  setEditingTaskTitle("");
                                }
                              }}
                              autoFocus
                              className="min-w-[120px] rounded border border-[#8a9a5b] bg-white px-2 py-1 text-sm font-medium text-[#323338] focus:outline-none focus:ring-2 focus:ring-[#8a9a5b]/40"
                            />
                          ) : (
                            <span
                              role="button"
                              tabIndex={0}
                              onDoubleClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditingTaskId(task.id);
                                setEditingTaskTitle(task.title);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setEditingTaskId(task.id);
                                  setEditingTaskTitle(task.title);
                                }
                              }}
                              className={`cursor-text text-sm font-medium ${
                                task.is_completed
                                  ? "text-[#323338]/50 line-through"
                                  : "text-[#323338]"
                              }`}
                            >
                              {task.title}
                            </span>
                          )}
                        </button>
                        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                          <select
                            value={task.assigned_to ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              handleAssignTask(task, v === "" ? null : v);
                            }}
                            className="rounded border border-[#e2e6e3] bg-white px-2.5 py-1 text-xs font-medium text-[#323338] focus:border-[#8a9a5b] focus:outline-none focus:ring-1 focus:ring-[#8a9a5b]"
                          >
                            <option value="">Unassigned</option>
                            {members.map((m) => {
                              const val = assigneeValueForMember(m);
                              return (
                                <option key={m.id} value={val}>
                                  {val}
                                </option>
                              );
                            })}
                            {/* Include legacy assignee values so old tasks display correctly */}
                            {task.assigned_to &&
                              !members.some(
                                (m) => assigneeValueForMember(m) === task.assigned_to,
                              ) && (
                                <option key={task.assigned_to} value={task.assigned_to}>
                                  {task.assigned_to}
                                </option>
                              )}
                          </select>
                          <div className="flex items-center gap-2">
                            {task.assigned_to ? (
                              <span
                                className="inline-flex h-6 items-center rounded-md px-2 text-xs font-medium text-white shadow-sm"
                                style={{
                                  backgroundColor: getColorForAssignee(
                                    task.assigned_to,
                                  ),
                                }}
                                title={task.assigned_to}
                              >
                                {(() => {
                                  const m = members.find(
                                    (x) =>
                                      assigneeValueForMember(x) ===
                                      task.assigned_to,
                                  );
                                  return m
                                    ? getInitialsForEmail(m.email ?? "")
                                    : task.assigned_to
                                        .split(/\s+/)
                                        .map((w) => w[0])
                                        .join("")
                                        .slice(0, 2)
                                        .toUpperCase() ||
                                        task.assigned_to.slice(0, 2);
                                })()}
                              </span>
                            ) : null}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingTaskId(task.id);
                                setEditingTaskTitle(task.title);
                              }}
                              className="rounded p-1.5 text-[#323338]/50 transition hover:bg-[#8a9a5b]/10 hover:text-[#8a9a5b]"
                              aria-label="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTask(task)}
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
          className="fixed bottom-0 left-0 right-0 border-t border-[#e2e6e3] bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] md:left-64"
        >
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <input
              type="text"
              value={newTask}
              onChange={(event) => setNewTask(event.target.value)}
              placeholder="Add an item..."
              className="h-11 flex-1 rounded-lg border border-[#e2e6e3] bg-[#f8f9f6] px-4 text-sm text-[#323338] placeholder:text-[#323338]/50 focus:border-[#8a9a5b] focus:outline-none focus:ring-2 focus:ring-[#8a9a5b]/20"
            />
            <button
              type="submit"
              disabled={isSaving || !newTask.trim()}
              className="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-[#8a9a5b] px-5 text-sm font-semibold text-white transition hover:bg-[#6b7b4b] disabled:cursor-not-allowed disabled:opacity-50"
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
