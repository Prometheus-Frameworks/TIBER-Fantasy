import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Users, Link as LinkIcon, FileText, Heart, Shield } from "lucide-react";

export default function CommunityPosts() {
  const [postName, setPostName] = useState("");
  const [postLink, setPostLink] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Future implementation for post submission
    console.log("Post submission:", { name: postName, link: postLink });
    setPostName("");
    setPostLink("");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Community Manifesto */}
      <div className="community-intro">
        <h2>Welcome to the Signal Community</h2>
        <p>This space exists for anyone who wants to share their work. Articles, fantasy takes, social media threads—whatever you've created, it belongs here.</p>
        <p>Signal Community isn't a classroom. It's the schoolyard. You're not here to be taught. You're here to create—and see what others are building too.</p>
        <p>Putting yourself out there isn't easy. This platform respects that. Every post, no matter how small, is a step forward.</p>
        <p>The goal isn't always feedback. It's reflection. It's trust. It's creativity.</p>
        <p>Post what you're proud of. Reflect what others share. This is where you belong.</p>
      </div>

      {/* No Gambling Policy */}
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-800">
            <Shield className="h-5 w-5" />
            No Gambling Policy
          </CardTitle>
        </CardHeader>
        <CardContent className="text-red-700">
          <div className="space-y-4">
            <p className="font-semibold">No Gambling. No Exceptions.</p>
            
            <p>
              We're here to help you win your fantasy football leagues — whether free or paid. Paid leagues are part of the game, and we're glad to support players who enjoy competing for prizes among friends.
            </p>
            
            <p>But we draw a hard line:</p>
            
            <p className="font-medium">
              This platform does not support sports betting, DFS (daily fantasy), or any form of gambling.
            </p>
            
            <p>
              We don't profit from gambling, we don't encourage it, and we're not responsible for your financial decisions. If you're here looking for betting advice, this is not the place for you.
            </p>
            
            <p className="font-medium">
              We build tools to help players learn. Not to feed gambling addiction.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            Community Posts
          </h1>
          <p className="text-gray-600">Share your fantasy football insights and discoveries</p>
        </div>
      </div>

      {/* Submit Post Form */}
      <Card className="border-dashed border-2 border-gray-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Share Your Work
          </CardTitle>
          <CardDescription>
            Submit your fantasy football content to the community
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="post-name">Post Title/Name</Label>
                <Input
                  id="post-name"
                  type="text"
                  placeholder="e.g., My Week 15 Sleeper Picks"
                  value={postName}
                  onChange={(e) => setPostName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="post-link">Link to Your Content</Label>
                <Input
                  id="post-link"
                  type="url"
                  placeholder="https://..."
                  value={postLink}
                  onChange={(e) => setPostLink(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full md:w-auto">
              <LinkIcon className="h-4 w-4 mr-2" />
              Submit Post
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Coming Soon Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            Community Posts Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Building Community</h3>
            <p className="text-gray-600 mb-6">
              This space will showcase community-submitted fantasy football content, insights, and analysis.
            </p>
            <p className="text-sm text-gray-500">
              Submit your content above to be featured when the community section launches.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}