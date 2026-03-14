"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  MessageSquare,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Video,
  Image,
} from "lucide-react";

interface ClientTestimonial {
  id: string;
  headshot_url: string;
  quote: string;
  attribution: string;
  sort_order: number;
  visible: boolean;
  created_at: string;
  updated_at: string;
}

interface VideoTestimonial {
  id: string;
  video_url: string;
  avatar_url: string | null;
  client_name: string;
  quote: string;
  sort_order: number;
  visible: boolean;
  created_at: string;
  updated_at: string;
}

export default function AdminTestimonialsPage() {
  const queryClient = useQueryClient();
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [editingText, setEditingText] = useState<ClientTestimonial | null>(null);
  const [editingVideo, setEditingVideo] = useState<VideoTestimonial | null>(null);

  const [headshotUrl, setHeadshotUrl] = useState("");
  const [quote, setQuote] = useState("");
  const [attribution, setAttribution] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [visible, setVisible] = useState(true);

  const [videoUrl, setVideoUrl] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [clientName, setClientName] = useState("");
  const [videoQuote, setVideoQuote] = useState("");
  const [videoSortOrder, setVideoSortOrder] = useState(0);
  const [videoVisible, setVideoVisible] = useState(true);

  const [saving, setSaving] = useState(false);

  const { data: textTestimonials = [], isLoading: loadingText } = useQuery({
    queryKey: ["admin", "testimonials"],
    queryFn: async () => {
      const res = await fetch("/api/admin/testimonials");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: videoTestimonials = [], isLoading: loadingVideo } = useQuery({
    queryKey: ["admin", "video-testimonials"],
    queryFn: async () => {
      const res = await fetch("/api/admin/video-testimonials");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  function resetTextForm() {
    setEditingText(null);
    setHeadshotUrl("");
    setQuote("");
    setAttribution("");
    setSortOrder(textTestimonials.length);
    setVisible(true);
    setTextDialogOpen(false);
  }

  function resetVideoForm() {
    setEditingVideo(null);
    setVideoUrl("");
    setAvatarUrl("");
    setClientName("");
    setVideoQuote("");
    setVideoSortOrder(videoTestimonials.length);
    setVideoVisible(true);
    setVideoDialogOpen(false);
  }

  function openEditText(t: ClientTestimonial) {
    setEditingText(t);
    setHeadshotUrl(t.headshot_url);
    setQuote(t.quote);
    setAttribution(t.attribution);
    setSortOrder(t.sort_order);
    setVisible(t.visible);
    setTextDialogOpen(true);
  }

  function openEditVideo(t: VideoTestimonial) {
    setEditingVideo(t);
    setVideoUrl(t.video_url);
    setAvatarUrl(t.avatar_url ?? "");
    setClientName(t.client_name);
    setVideoQuote(t.quote);
    setVideoSortOrder(t.sort_order);
    setVideoVisible(t.visible);
    setVideoDialogOpen(true);
  }

  async function saveTextTestimonial() {
    setSaving(true);
    try {
      const payload = {
        headshot_url: headshotUrl,
        quote,
        attribution,
        sort_order: sortOrder,
        visible,
      };
      const url = editingText
        ? `/api/admin/testimonials/${editingText.id}`
        : "/api/admin/testimonials";
      const method = editingText ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(editingText ? "Testimonial updated" : "Testimonial added");
      queryClient.invalidateQueries({ queryKey: ["admin", "testimonials"] });
      resetTextForm();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function saveVideoTestimonial() {
    setSaving(true);
    try {
      const payload = {
        video_url: videoUrl,
        avatar_url: avatarUrl || null,
        client_name: clientName,
        quote: videoQuote,
        sort_order: videoSortOrder,
        visible: videoVisible,
      };
      const url = editingVideo
        ? `/api/admin/video-testimonials/${editingVideo.id}`
        : "/api/admin/video-testimonials";
      const method = editingVideo ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(editingVideo ? "Video testimonial updated" : "Video testimonial added");
      queryClient.invalidateQueries({ queryKey: ["admin", "video-testimonials"] });
      resetVideoForm();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTextTestimonial(id: string) {
    if (!confirm("Delete this testimonial?")) return;
    try {
      const res = await fetch(`/api/admin/testimonials/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "testimonials"] });
    } catch {
      toast.error("Failed to delete");
    }
  }

  async function deleteVideoTestimonial(id: string) {
    if (!confirm("Delete this video testimonial?")) return;
    try {
      const res = await fetch(`/api/admin/video-testimonials/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "video-testimonials"] });
    } catch {
      toast.error("Failed to delete");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-muted-foreground" />
          Home Page Testimonials
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage &quot;What Our Clients Say&quot; and video testimonials on the public homepage
        </p>
      </div>

      <Tabs defaultValue="text" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="text">Text Testimonials</TabsTrigger>
          <TabsTrigger value="video">Video Testimonials</TabsTrigger>
        </TabsList>

        <TabsContent value="text" className="space-y-4">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">What Our Clients Say</CardTitle>
              <Button
                onClick={() => {
                  resetTextForm();
                  setSortOrder(textTestimonials.length);
                  setTextDialogOpen(true);
                }}
                size="sm"
                className="bg-gradient-to-r from-[#00D4FF] to-[#0EA5E9] text-[#0A0B0F]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </CardHeader>
            <CardContent>
              {loadingText ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </div>
              ) : textTestimonials.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No testimonials yet. Add headshots, quotes, and attributions (e.g. &quot;– Family Office CIO, Dubai&quot;).
                </p>
              ) : (
                <div className="space-y-3">
                  {textTestimonials.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-4 p-4 rounded-lg bg-background/50 border border-border"
                    >
                      <img
                        src={t.headshot_url}
                        alt=""
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">&ldquo;{t.quote}&rdquo;</p>
                        <p className="text-xs text-muted-foreground">{t.attribution}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            t.visible ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {t.visible ? "Visible" : "Hidden"}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEditText(t)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteTextTestimonial(t.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="video" className="space-y-4">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Client Video Testimonials</CardTitle>
              <Button
                onClick={() => {
                  resetVideoForm();
                  setVideoSortOrder(videoTestimonials.length);
                  setVideoDialogOpen(true);
                }}
                size="sm"
                className="bg-gradient-to-r from-[#00D4FF] to-[#0EA5E9] text-[#0A0B0F]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </CardHeader>
            <CardContent>
              {loadingVideo ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </div>
              ) : videoTestimonials.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No video testimonials yet. Add video URLs, client names, and quotes.
                </p>
              ) : (
                <div className="space-y-3">
                  {videoTestimonials.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-4 p-4 rounded-lg bg-background/50 border border-border"
                    >
                      <div className="w-16 h-10 rounded overflow-hidden bg-muted shrink-0">
                        <video src={t.video_url} className="w-full h-full object-cover" muted preload="none" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{t.client_name}</p>
                        <p className="text-xs text-muted-foreground truncate">&ldquo;{t.quote}&rdquo;</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            t.visible ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {t.visible ? "Visible" : "Hidden"}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEditVideo(t)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteVideoTestimonial(t.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Text testimonial dialog */}
      <Dialog open={textDialogOpen} onOpenChange={setTextDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingText ? "Edit Testimonial" : "Add Testimonial"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Headshot URL</Label>
              <Input
                value={headshotUrl}
                onChange={(e) => setHeadshotUrl(e.target.value)}
                placeholder="https://..."
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label>Quote</Label>
              <Textarea
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                placeholder="The execution quality is on par with my institutional desk."
                className="bg-background/50 min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Attribution</Label>
              <Input
                value={attribution}
                onChange={(e) => setAttribution(e.target.value)}
                placeholder="– Family Office CIO, Dubai"
                className="bg-background/50"
              />
            </div>
            <div className="flex gap-4">
              <div className="space-y-2 flex-1">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2 flex items-end">
                <Label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={visible}
                    onChange={(e) => setVisible(e.target.checked)}
                    className="rounded"
                  />
                  Visible
                </Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetTextForm}>
              Cancel
            </Button>
            <Button
              onClick={saveTextTestimonial}
              disabled={saving || !headshotUrl || !quote || !attribution}
              className="bg-gradient-to-r from-[#00D4FF] to-[#0EA5E9] text-[#0A0B0F]"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video testimonial dialog */}
      <Dialog open={videoDialogOpen} onOpenChange={setVideoDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingVideo ? "Edit Video Testimonial" : "Add Video Testimonial"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Video URL</Label>
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://... (mp4, webm)"
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label>Client Avatar URL (optional)</Label>
              <Input
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label>Client Name</Label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="John Smith"
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label>Quote</Label>
              <Textarea
                value={videoQuote}
                onChange={(e) => setVideoQuote(e.target.value)}
                placeholder="Grew my portfolio 42% in 6 months – seamless VIP experience"
                className="bg-background/50 min-h-[60px]"
              />
            </div>
            <div className="flex gap-4">
              <div className="space-y-2 flex-1">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={videoSortOrder}
                  onChange={(e) => setVideoSortOrder(parseInt(e.target.value, 10) || 0)}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2 flex items-end">
                <Label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={videoVisible}
                    onChange={(e) => setVideoVisible(e.target.checked)}
                    className="rounded"
                  />
                  Visible
                </Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetVideoForm}>
              Cancel
            </Button>
            <Button
              onClick={saveVideoTestimonial}
              disabled={saving || !videoUrl || !clientName || !videoQuote}
              className="bg-gradient-to-r from-[#00D4FF] to-[#0EA5E9] text-[#0A0B0F]"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
