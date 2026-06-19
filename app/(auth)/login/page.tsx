"use client";

import { useState } from "react";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  // states hold on page
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // email + pass login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); // Preven browser reload everything , handle it ourselves
    setLoading(true);
    setError("");

    // superbase object handles the request send to server
    // it auto wrap http request, no need to use fetch() + url + query
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError(error.message);
    } else {
      router.push("/home");
    }
    setLoading(false);
  };

  // use google oauth login
  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` }, // redirect call back after verification
    });
    if (error) setError(error.message);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* icon + title + intro text  */}

        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-[#1a1a1d] border border-[#2a2a2d]">
            <BookOpen className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-[#111827] tracking-tight">
            Good Library
          </h1>
          <p className="text-sm text-[#6b7280]">Find your next great read</p>
        </div>

        {/* form containner  for the login section
          it auto trigger submit when the button in it is click , call our handleLogin function 
        */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm text-[#374151]">
              Email
            </Label>

            {/* input for email  */}
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)} // when user input set the state
              className="h-11 bg-white border-[#d1d5db]"
              required
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
              className="h-11 bg-white border-[#d1d5db]"
              required
            />
          </div>

          {/* Because it uses type="submit" inside a <form onSubmit ..></form> */}

          {/* When the user clicks the button, the browser's native form submission fires 
          the onSubmit event on the <form>, which calls handleLogin. No onClick needed. */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-[#111827] text-white font-medium hover:bg-[#1f2937] transition-colors"
          >
            {loading ? "Logging in..." : "Login"}
          </Button>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        </form>

        <p className="text-center text-sm text-[#6b7280]">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-[#111827] font-medium hover:underline underline-offset-4 transition-colors"
          >
            Register
          </Link>
        </p>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#e5e7eb]" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-[#f8f9fa] px-3 text-[#9ca3af]">or</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full h-11"
          onClick={handleGoogleLogin}
        >
          Continue with Google
        </Button>
      </div>
    </div>
  );
}
