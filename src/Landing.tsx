import { useEffect, useRef, useState, useId, useMemo } from "react";
import { ArrowDown, MapPin, MoveUpRight } from "lucide-react";
import { Logo, EnterLink } from "./components";
import campus from "./illustrations/campus.svg?raw";
import lake from "./illustrations/lake.svg?raw";
import library from "./illustrations/library.svg?raw";
import teaching from "./illustrations/teaching.svg?raw";

function Illustration({
  source,
  className = "",
}: {
  source: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const uniqueId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const markup = useMemo(
    () =>
      source
        .replace(/id="([^"]+)"/g, `id="${uniqueId}-$1"`)
        .replace(/url\(#([^)]+)\)/g, `url(#${uniqueId}-$1)`),
    [source, uniqueId],
  );
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const layers = Array.from(
      root.querySelectorAll<SVGGElement>("[data-depth]"),
    );
    let active = false,
      frame = 0;
    function render() {
      frame = 0;
      if (!root || !active || media.matches) return;
      const rect = root.getBoundingClientRect();
      const progress = Math.max(
        -1,
        Math.min(
          1,
          (rect.top + rect.height / 2 - innerHeight / 2) / innerHeight,
        ),
      );
      layers.forEach((layer) => {
        const depth = Number(layer.dataset.depth);
        layer.style.transform = `translateY(${(progress * depth).toFixed(2)}px)`;
        layer.style.opacity = String(
          Math.min(1, Math.max(0.25, 1 - Math.max(0, progress - 0.2) * 0.75)),
        );
      });
    }
    function schedule() {
      if (active && !media.matches && !frame)
        frame = requestAnimationFrame(render);
    }
    function reset() {
      layers.forEach((layer) => {
        layer.style.transform = "";
        layer.style.opacity = "";
      });
      schedule();
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        active = entry.isIntersecting;
        if (active) schedule();
        else if (frame) {
          cancelAnimationFrame(frame);
          frame = 0;
        }
      },
      { rootMargin: "60px" },
    );
    observer.observe(root);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    media.addEventListener("change", reset);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      media.removeEventListener("change", reset);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div
      ref={ref}
      className={`illustration ${className}`}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
const chapters = [
  {
    id: "lake",
    number: "01",
    en: "BY THE LAKE",
    name: "科大湖",
    title: "从湖边的日常聊起。",
    text: "一阵晚风，一场偶遇，一个平凡却值得分享的瞬间。\n校园里的小事，总有人愿意听。",
    source: lake,
    annotation: "沿着湖岸，把日子慢慢走成故事。",
  },
  {
    id: "library",
    number: "02",
    en: "BETWEEN THE PAGES",
    name: "图书馆",
    title: "让问题在这里找到回应。",
    text: "从一道难题，到一个新想法。\n交换知识，也交换向前走的勇气。",
    source: library,
    annotation: "每一扇亮着的窗，都装着一种可能。",
  },
  {
    id: "teaching",
    number: "03",
    en: "BEYOND THE CLASSROOM",
    name: "教学楼",
    title: "下课之后，讨论继续。",
    text: "课表之外，还有更大的校园。\n找到同频的人，让下一段故事从这里开始。",
    source: teaching,
    annotation: "下一站，去遇见正在这里的同学。",
  },
];
export function Landing() {
  const [active, setActive] = useState("welcome");
  useEffect(() => {
    document.title = "SustLink · 在这里，遇见科大的每一天";
    const sections = document.querySelectorAll<HTMLElement>(".story-section");
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        }),
      { rootMargin: "-35% 0px -40% 0px" },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);
  return (
    <div className="landing">
      <a className="skip-link" href="#welcome">
        跳到主要内容
      </a>
      <header className="landing-header">
        <Logo />
        <nav aria-label="校园导航">
          <span className="school-label">陕西科技大学 · 校园社区</span>
          <EnterLink className="entry-outline" />
        </nav>
      </header>
      <nav className="chapter-nav" aria-label="校园章节">
        {[{ id: "welcome", name: "初见" }, ...chapters].map((c, i) => (
          <a
            href={`#${c.id}`}
            key={c.id}
            className={active === c.id ? "active" : ""}
            aria-label={c.name}
            aria-current={active === c.id ? "location" : undefined}
          >
            <span>0{i}</span>
            <i />
            <b>{c.name}</b>
          </a>
        ))}
      </nav>
      <main>
        <section id="welcome" className="story-section welcome">
          <div className="hero-copy">
            <p className="eyebrow">
              <span /> A LITTLE CLOSER, A LITTLE MORE CONNECTED
            </p>
            <h1>
              在这里，遇见科大的
              <span className="accent-title">
                每一天
                <svg viewBox="0 0 150 12" aria-hidden="true">
                  <path d="M2 8Q70-2 148 5" />
                </svg>
              </span>
              。
            </h1>
            <p className="hero-description">
              分享日常，交换想法。
              <br />
              把熟悉的校园，变成彼此相连的地方。
            </p>
            <EnterLink className="hero-enter">去社区逛逛</EnterLink>
          </div>
          <span className="hero-side-note">OUR CAMPUS, OUR STORIES.</span>
          <Illustration source={campus} className="hero-illustration" />
          <div className="hero-bottom">
            <span>
              <MapPin size={13} /> XI’AN · SUST
            </span>
            <a href="#lake">
              <ArrowDown size={15} />
              向下探索我们的校园
            </a>
            <span>一方校园 · 无数种可能</span>
          </div>
        </section>
        {chapters.map((chapter) => (
          <section
            className={`story-section landmark-section ${chapter.id}-section`}
            id={chapter.id}
            key={chapter.id}
          >
            <div className="chapter-heading">
              <div className="chapter-caption">
                <span className="chapter-number">{chapter.number}</span>
                <span>
                  {chapter.en}
                  <br />
                  <b>{chapter.name}</b>
                </span>
              </div>
              <div className="chapter-copy">
                <h2>{chapter.title}</h2>
                <p>{chapter.text}</p>
              </div>
            </div>
            <Illustration source={chapter.source} />
            <div className="chapter-bottom">
              <span className="landmark-note">
                <i />
                {chapter.annotation}
              </span>
              {chapter.id === "teaching" ? (
                <EnterLink className="hero-enter">
                  进入论坛，开始你的故事
                </EnterLink>
              ) : (
                <a
                  href={chapter.id === "lake" ? "#library" : "#teaching"}
                  className="next-chapter"
                >
                  继续漫游
                  <ArrowDown size={16} />
                </a>
              )}
            </div>
          </section>
        ))}
      </main>
      <footer className="landing-footer">
        <div>
          <Logo />
          <span>连接科大，连接你我。</span>
        </div>
        <p>校园概念插画 · 交互原型 · 非学校官方网站</p>
        <a href="/forum">
          在社区见 <MoveUpRight size={14} />
        </a>
      </footer>
    </div>
  );
}
