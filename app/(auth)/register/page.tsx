"use client";

import { useState } from "react";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // register with supabase.signUp
  // Creates a new user.
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); // Preven browser reload everything , handle it ourselves
    setError(""); // reset default

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    // Supabase signUp — the handle_new_user trigger uses full_name from raw_user_meta_data
    // follow offical doc , other than email and pass the other meta data place inside

    // options: {
    //   data: {
    //     first_name: 'John',
    //     age: 27,
    //     ...
    //   }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: displayName } },
    });

    if (error) {
      setError(error.message);
    } else {
      router.push("/home"); // success , router jump to home page
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-[#1a1a1d] border border-[#2a2a2d]">
            <BookOpen className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-[#111827] tracking-tight">
            Good Library
          </h1>
          <p className="text-sm text-[#6b7280]">Create your account</p>
        </div>

        {/* form input handle the sumbit from browser event , when button click auto trigger submit  */}
        <form onSubmit={handleRegister} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="displayName" className="text-sm text-[#374151]">
              Display Name
            </Label>
            <Input
              id="displayName"
              type="text"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="h-11 bg-white border-[#d1d5db]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm text-[#374151]">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11 bg-white border-[#d1d5db]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm text-[#374151]">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-11 bg-white border-[#d1d5db]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm text-[#374151]">
              Confirm Password
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="h-11 bg-white border-[#d1d5db]"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-[#111827] text-white font-medium hover:bg-[#1f2937] transition-colors"
          >
            {loading ? "Creating account..." : "Create Account"}
          </Button>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        </form>

        <p className="text-center text-sm text-[#6b7280]">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-[#111827] font-medium hover:underline underline-offset-4 transition-colors"
          >
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
