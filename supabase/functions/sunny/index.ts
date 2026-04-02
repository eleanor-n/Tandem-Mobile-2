const SUNNY_SYSTEM_PROMPT = `You are Sunny, the voice of Tandem — a platonic social connection app.

Rules you never break:
- Always lowercase, no exclamation points, no emojis
- Maximum 1-2 short sentences. Never more.
- Never address the host directly — you're talking TO the user, not to the other person
- Never say "tandem" as a noun for the app — use "tandeming" or "go tandem" naturally
- Dry, understated humor. Warm but not gushing. Like a friend, not a chatbot.
- Never give advice or suggestions. Just react to the moment.
- Never start with "looks like", "seems like", or "guess"`

Deno.serve(async (req) => {
  try {
    const { context, activityTitle, hostName, stepKey, userName, userAnswer } = await req.json()

    let prompt = ""
    if (context === "imIn") {
      prompt = `User just sent a tandem request to join "${activityTitle ?? "an activity"}" posted by ${hostName ?? "someone"}. Write a warm 1-sentence response as Sunny.`
    } else if (context === "emptyDiscover") {
      prompt = "The discover feed is empty — no activities nearby. Write a 1-2 sentence Sunny response."
    } else if (context === "emptyNotifications") {
      prompt = "Notifications screen is empty. Write a 1-2 sentence Sunny response."
    } else if (context === "emptyScrapbook") {
      prompt = "Scrapbook is empty — user hasn't attended any activities yet. Write a 1-2 sentence Sunny response."
    } else if (context === "emptyMessages") {
      prompt = "Messages screen is empty — no conversations yet. Write a 1-2 sentence Sunny response."
    } else if (context === "onboarding") {
      prompt = `The user's name is ${userName ?? "this person"}. They were asked "${stepKey ?? "a question"}" during onboarding and answered: "${userAnswer ?? "something"}". Give a short genuine Sunny reaction in 1 sentence. Lowercase, no exclamation points.`
    } else {
      prompt = "Write a short warm Sunny response for a Tandem app moment."
    }

    const groqKey = Deno.env.get("GROQ_API_KEY") ?? ""
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        max_tokens: 100,
        messages: [
          { role: "system", content: SUNNY_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
      }),
    })

    const data = await response.json()
    console.log("Groq status:", response.status)
    console.log("Groq response:", JSON.stringify(data))
    const text = data.choices?.[0]?.message?.content ?? null

    if (!text) {
      return new Response(JSON.stringify({ error: "groq_error", detail: JSON.stringify(data) }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ text }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("Sunny error:", err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
