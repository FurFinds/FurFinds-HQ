import { requireProfile } from "@/lib/auth/session";
import { requireDepartmentAccess } from "@/lib/auth/guard";
import { getContentPosts, getBlogPosts, getCalendarEvents } from "@/lib/data/marketing";
import { ContentBoard, TemplateLibrary } from "@/components/marketing/ContentBoard";
import { BlogBoard } from "@/components/marketing/BlogBoard";
import { ContentCalendar } from "@/components/marketing/ContentCalendar";
import { Card, CardHeader } from "@/components/ui/Card";

export default async function MarketingPage() {
  const { profile } = await requireProfile();
  requireDepartmentAccess(profile, "marketing");

  const [posts, blogPosts, calendarEvents] = await Promise.all([
    getContentPosts(),
    getBlogPosts(),
    getCalendarEvents(),
  ]);
  const canManage = profile.role === "admin" || profile.role === "content_editor";
  const library = posts.filter((p) => p.status === "published");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Marketing</h2>
        <p className="text-sm text-slate-500">
          Plan content, reuse templates, and browse what&rsquo;s already published.
        </p>
      </div>

      <Card>
        <CardHeader title="Blog" subtitle="Draft, edit, and publish articles for the public /blog feed" />
        <BlogBoard posts={blogPosts} canManage={canManage} />
      </Card>

      <Card>
        <CardHeader title="Content Calendar" subtitle="Month, week, and day views — social posts, meetings, deadlines" />
        <ContentCalendar events={calendarEvents} />
      </Card>

      <Card>
        <CardHeader title="Scheduled Content" subtitle="Upcoming and draft posts across channels" />
        <ContentBoard posts={posts} canManage={canManage} />
      </Card>

      <Card>
        <CardHeader title="Post Templates" subtitle="Reusable copy to speed up content creation" />
        <TemplateLibrary />
      </Card>

      <Card>
        <CardHeader title="Content Library" subtitle={`${library.length} published posts`} />
        {library.length === 0 ? (
          <p className="text-sm text-slate-400">Nothing published yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {library.map((post) => (
              <li key={post.id} className="py-2 text-sm text-slate-700">
                <span className="font-medium">{post.title}</span>{" "}
                <span className="text-slate-400">· {post.channel}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
