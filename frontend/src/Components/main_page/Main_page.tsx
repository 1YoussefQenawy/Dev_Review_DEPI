import { NavLink } from 'react-router-dom'
import Robot from '../robot/Robot'
import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const BugIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="8" y="6" width="8" height="14" rx="4" /><path d="M6 10h-2" /><path d="M6 14h-2" /><path d="M20 10h-2" /><path d="M20 14h-2" /><path d="M9 2l1 2" /><path d="M15 2l-1 2" /><path d="M12 10v4" />
    </svg>
)
const ZapIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
)
const ShieldIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" />
    </svg>
)
const SparklesIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" /><path d="M18 15l.75 2.25L21 18l-2.25.75L18 21l-.75-2.25L15 18l2.25-.75L18 15z" />
    </svg>
)

const features = [
    { icon: <BugIcon />, title: 'Bug Detection', desc: 'Catch hidden bugs and edge cases before they reach production.' },
    { icon: <ZapIcon />, title: 'Performance Tips', desc: 'Get actionable suggestions to optimize speed and efficiency.' },
    { icon: <ShieldIcon />, title: 'Security Analysis', desc: 'Identify vulnerabilities and enforce secure coding standards.' },
    { icon: <SparklesIcon />, title: 'Best Practices', desc: 'Follow industry patterns and clean code principles effortlessly.' },
]

const codeLines = [
    { parts: [{ text: 'function ', cls: 'code-keyword' }, { text: 'fetchUser', cls: 'code-func' }, { text: '(id) {', cls: 'code-plain' }] },
    { parts: [{ text: '  const ', cls: 'code-keyword' }, { text: 'res = await fetch(', cls: 'code-plain' }, { text: '`/api/${id}`', cls: 'code-string' }, { text: ')', cls: 'code-plain' }] },
    { parts: [{ text: '  // TODO: add error handling', cls: 'code-comment' }] },
    { parts: [{ text: '  return ', cls: 'code-keyword' }, { text: 'res.json()', cls: 'code-plain' }] },
    { parts: [{ text: '}', cls: 'code-plain' }] },
]

const reviewItems = [
    { badge: 'warning', label: 'Warning', text: 'Missing async keyword on fetchUser — await will cause a syntax error.' },
    { badge: 'error', label: 'Error', text: 'No error handling for failed network requests. Wrap in try/catch.' },
    { badge: 'tip', label: 'Tip', text: 'Consider validating the id parameter before making the API call.' },
]

export default function Main_page() {
    const mainRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (prefersReduced) return

        const ctx = gsap.context(() => {
            // Hero entrance
            gsap.from('.gsap-hero-text', { y: 40, opacity: 0, duration: 0.8, ease: 'power3.out' })
            gsap.from('.gsap-hero-sub', { y: 30, opacity: 0, duration: 0.7, delay: 0.2, ease: 'power3.out' })
            gsap.from('.gsap-hero-cta', { y: 20, opacity: 0, duration: 0.6, delay: 0.4, ease: 'power3.out' })
            gsap.from('.gsap-robot', { scale: 0.85, opacity: 0, duration: 1, delay: 0.3, ease: 'elastic.out(1, 0.75)' })

            // Features — timeline: title → desc → cards cascade → border pulse sweep
            const featureTl = gsap.timeline({
                scrollTrigger: { trigger: '.features-section', start: 'top 80%', toggleActions: 'play none none none' },
            })
            featureTl
                .from('.features-section .section-title', { y: 30, opacity: 0, duration: 0.6, ease: 'power3.out' })
                .from('.features-section .section-desc', { y: 20, opacity: 0, duration: 0.5, ease: 'power3.out' }, '-=0.3')
                .from('.feature-card', {
                    y: 60, opacity: 0, scale: 0.92, duration: 0.7, stagger: 0.14, ease: 'back.out(1.4)',
                }, '-=0.15')
                .to('.feature-card', {
                    borderColor: 'rgba(139, 92, 246, 0.5)', duration: 0.3, stagger: 0.1, ease: 'power1.in',
                })
                .to('.feature-card', {
                    borderColor: 'rgba(139, 92, 246, 0.15)', duration: 0.5, stagger: 0.1, ease: 'power1.out',
                }, '-=0.3')

            // Code reveal — lines appear one by one
            gsap.from('.code-line', {
                scrollTrigger: { trigger: '.code-preview', start: 'top 80%', toggleActions: 'play none none none' },
                x: -30, opacity: 0, duration: 0.4, stagger: 0.15, ease: 'power2.out',
            })

            // Scan line sweep
            gsap.to('.code-scan-line', {
                scrollTrigger: { trigger: '.code-preview', start: 'top 75%', toggleActions: 'play none none none' },
                top: '100%', opacity: 1, duration: 1.2, delay: 1, ease: 'power1.inOut',
            })

            // Review results appear after scan
            gsap.from('.review-item', {
                scrollTrigger: { trigger: '.review-result', start: 'top 85%', toggleActions: 'play none none none' },
                x: 30, opacity: 0, duration: 0.5, stagger: 0.18, ease: 'power2.out',
            })

            // CTA section
            gsap.from('.cta-heading', {
                scrollTrigger: { trigger: '.cta-section', start: 'top 85%', toggleActions: 'play none none none' },
                y: 30, opacity: 0, duration: 0.7, ease: 'power3.out',
            })
        }, mainRef)

        return () => ctx.revert()
    }, [])

    return (
        <div ref={mainRef}>
            {/* ── Hero Section ── */}
            <div className="custom-bg min-vh-100 d-flex align-items-center">
                <div className="container">
                    <div className="row align-items-center">
                        <div className="col-lg-6 hero-content">
                            <h1 className="hero-text text gsap-hero-text">Elevate Your Code Quality with Instant AI Reviews</h1>
                            <p className="hero-subtitle gsap-hero-sub">Get intelligent, real-time feedback on your code. Catch bugs, improve performance, and follow best practices.</p>
                            <NavLink to="/register" className="btn-cta-primary gsap-hero-cta">Get Started for Free</NavLink>
                        </div>
                        <div className="col-lg-6 d-flex justify-content-center">
                            <div className="robot-container gsap-robot">
                                <Robot />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Features Section ── */}
            <div className="custom-bg main-section features-section">
                <div className="container">
                    <div className="text-center mb-5">
                        <h2 className="section-title">Why DevReview AI?</h2>
                        <p className="section-desc mx-auto">Powerful AI-driven code analysis that helps you ship better software, faster.</p>
                    </div>
                    <div className="row g-4">
                        {features.map((f, i) => (
                            <div className="col-md-6 col-lg-3" key={i}>
                                <div className="feature-card h-100">
                                    <span className="feature-icon">{f.icon}</span>
                                    <h3 className="feature-card-title">{f.title}</h3>
                                    <p className="feature-card-desc">{f.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Code → Review Section ── */}
            <div className="custom-bg main-section">
                <div className="container">
                    <div className="text-center mb-5">
                        <h2 className="section-title">See It In Action</h2>
                        <p className="section-desc mx-auto">Watch your code get scanned and reviewed in real time.</p>
                    </div>
                    <div className="row g-4 align-items-start">
                        <div className="col-lg-6">
                            <div className="code-preview">
                                <div className="code-scan-line" style={{ top: 0 }} />
                                {codeLines.map((line, i) => (
                                    <span className="code-line" key={i}>
                                        {line.parts.map((p, j) => (
                                            <span className={p.cls} key={j}>{p.text}</span>
                                        ))}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="col-lg-6">
                            <div className="review-result">
                                {reviewItems.map((r, i) => (
                                    <div className="review-item" key={i}>
                                        <span className={`review-badge review-badge-${r.badge}`}>{r.label}</span>
                                        <p className="review-item-text">{r.text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── CTA Section ── */}
            <div className="custom-bg cta-section">
                <div className="container">
                    <h2 className="cta-heading">Ready to Improve Your Code?</h2>
                    <p className="cta-desc">Join developers who ship cleaner, safer code with AI-powered reviews.</p>
                    <NavLink to="/register" className="btn-cta-primary">Start Free Review</NavLink>
                </div>
            </div>
        </div>
    )
}
