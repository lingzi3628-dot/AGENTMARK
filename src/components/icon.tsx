"use client";

import {
  Sparkles, Bot, Brain, Code, PenTool, Search, FileText, Languages,
  Database, Rocket, Lightbulb, Wand2, Play, Wrench, Flag, Globe,
  Tags, Image, Eye, Link, type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  bot: Bot,
  brain: Brain,
  code: Code,
  "pen-tool": PenTool,
  search: Search,
  "file-text": FileText,
  languages: Languages,
  database: Database,
  rocket: Rocket,
  lightbulb: Lightbulb,
  "wand-2": Wand2,
  play: Play,
  wrench: Wrench,
  flag: Flag,
  globe: Globe,
  tags: Tags,
  image: Image,
  eye: Eye,
  link: Link,
};

export function Icon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Cmp = MAP[name] ?? Sparkles;
  return <Cmp className={className} />;
}

export function iconExists(name: string) {
  return name in MAP;
}
