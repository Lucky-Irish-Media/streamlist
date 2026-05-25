'use client'

export default function LoadingImage() {
  return (
    <div className="loading-image">
      <svg
        width="200"
        height="200"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="film-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3">
              <animate
                attributeName="stopOpacity"
                values="0.3;0.6;0.3"
                dur="2s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.6">
              <animate
                attributeName="stopOpacity"
                values="0.6;0.3;0.6"
                dur="2s"
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>
        </defs>

        <rect
          x="50"
          y="45"
          width="100"
          height="75"
          rx="6"
          fill="url(#film-grad)"
          stroke="var(--accent)"
          strokeWidth="1.5"
          strokeOpacity="0.4"
        />

        {[55, 70, 85, 100, 115].map((x, i) => (
          <rect
            key={x}
            x={x}
            y="50"
            width="4"
            height="6"
            rx="0.5"
            fill="var(--accent)"
            fillOpacity="0.5"
          >
            <animate
              attributeName="fillOpacity"
              values="0.5;0.2;0.5"
              dur="1.5s"
              begin={`${i * 0.3}s`}
              repeatCount="indefinite"
            />
          </rect>
        ))}

        <rect x="55" y="62" width="90" height="50" rx="3" fill="var(--bg-primary)" fillOpacity="0.3" />

        <circle cx="100" cy="87" r="16" stroke="var(--accent)" strokeWidth="1.5" strokeOpacity="0.4" fill="none">
          <animate
            attributeName="r"
            values="14;18;14"
            dur="2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="strokeOpacity"
            values="0.4;0.8;0.4"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>

        <polygon points="95,80 95,94 107,87" fill="var(--accent)" fillOpacity="0.6">
          <animate
            attributeName="fillOpacity"
            values="0.6;1;0.6"
            dur="2s"
            repeatCount="indefinite"
          />
        </polygon>

        <line x1="80" y1="128" x2="120" y2="128" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.3">
          <animate
            attributeName="strokeOpacity"
            values="0.3;0.6;0.3"
            dur="1.8s"
            repeatCount="indefinite"
          />
        </line>

        <line x1="90" y1="136" x2="110" y2="136" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.2">
          <animate
            attributeName="strokeOpacity"
            values="0.2;0.5;0.2"
            dur="1.8s"
            begin="0.3s"
            repeatCount="indefinite"
          />
        </line>

        <rect x="45" y="125" width="110" height="4" rx="2" fill="var(--bg-tertiary)" fillOpacity="0.15" />

        <g opacity="0.15">
          <rect x="50" y="125" width="30" height="4" rx="2" fill="var(--accent)">
            <animate
              attributeName="x"
              values="50;165;50"
              dur="4s"
              repeatCount="indefinite"
            />
          </rect>
        </g>

        <circle cx="50" cy="150" r="3" fill="var(--accent)" fillOpacity="0.2">
          <animate attributeName="r" values="2;4;2" dur="1.5s" repeatCount="indefinite" />
        </circle>
        <circle cx="70" cy="150" r="3" fill="var(--accent)" fillOpacity="0.2">
          <animate attributeName="r" values="2;4;2" dur="1.5s" begin="0.3s" repeatCount="indefinite" />
        </circle>
        <circle cx="90" cy="150" r="3" fill="var(--accent)" fillOpacity="0.2">
          <animate attributeName="r" values="2;4;2" dur="1.5s" begin="0.6s" repeatCount="indefinite" />
        </circle>
        <circle cx="110" cy="150" r="3" fill="var(--accent)" fillOpacity="0.2">
          <animate attributeName="r" values="2;4;2" dur="1.5s" begin="0.9s" repeatCount="indefinite" />
        </circle>
        <circle cx="130" cy="150" r="3" fill="var(--accent)" fillOpacity="0.2">
          <animate attributeName="r" values="2;4;2" dur="1.5s" begin="1.2s" repeatCount="indefinite" />
        </circle>
      </svg>
      <p className="loading-image-text">Loading your watchlist</p>
    </div>
  )
}
