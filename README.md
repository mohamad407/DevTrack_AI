# DevTrack AI 🚀

**DevTrack AI** is an AI-powered, Agile DevOps platform designed to bridge the gap between planning, code execution, and telemetry tracking. It aggregates development workflows—syncing tasks, commits, and project pipelines into a single, intuitive hub tailored for high-performing engineering teams.

---

## 🌟 Key Features

- **🤖 AI-Driven Agile Planning:** Automatically decomposes epic goals into actionable sprints and tasks with smart estimations.
- **🔄 Universal Engineering Sync:** Seamless, read-only integrations with GitHub, GitLab, Jira, and calendars to stream commits and status updates.
- **📊 Real-Time Analytics:** Dashboards tracking engineering velocity, bottlenecks, code review cycle times, and focus blocks.
- **🎙️ Automated Standups & Reports:** Learns from your git history to generate daily updates and performance telemetry that actually sounds like your team.

---

## 🏗️ Architecture & Tech Stack

DevTrack AI is built with a modern, decoupled architecture designed for high availability, low latency, and rapid deployment:

- **Frontend:** Next.js (React), Tailwind CSS
- **Backend / Proxy:** Powered by specialized AI Gateways optimized for automated failover and zero data retention (ZDR)
- **Deployment:** Vercel

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your local environment:
- Node.js (v18.x or higher)
- npm / pnpm / yarn

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com
   cd dev-track-ai
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Set up environment variables:**
   Create a `.env.local` file in the root directory and add your configurations:
   ```env
   NEXT_PUBLIC_API_URL=your_api_endpoint
   AI_GATEWAY_URL=your_vercel_ai_gateway_url
   GITHUB_CLIENT_ID=your_github_oauth_id
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   # or
   pnpm dev
   ```
   Open [http://localhost:3000](http://localhost:3000) with your browser to see the application live.

---

## 📦 Deployment

This platform is optimized for one-click deployments onto **Vercel**. 

[![Deploy with Vercel](https://vercel.com)](https://dev-track-ai-drab.vercel.app/)

To deploy manually via the Vercel CLI:
```bash
npm install -g vercel
vercel
```

---

## 🔒 Security & Data Privacy

- **Zero Data Retention (ZDR):** We route LLM workloads securely; customer operational data is never used for training models.
- **Read-Only Access:** Git integrations strictly leverage read-only tokens ensuring code security.

---

## 🤝 Contributing

We welcome contributions from the community! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) to check our code of conduct and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
