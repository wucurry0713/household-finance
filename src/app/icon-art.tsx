export function IconArtwork({ size }: { size: number }) {
  const cardSize = size * 0.49;
  const cardOffset = size * 0.225;

  return (
    <div
      style={{
        alignItems: "center",
        background: "#FBF9F5",
        border: "1px solid #EFECE6",
        borderRadius: size * 0.22,
        display: "flex",
        height: "100%",
        justifyContent: "center",
        overflow: "hidden",
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #B8976C 0%, #D4C3A3 100%)",
          borderRadius: size * 0.1,
          boxShadow: "0 14px 30px rgba(44, 38, 35, 0.12)",
          height: cardSize,
          left: cardOffset,
          position: "absolute",
          top: cardOffset * 0.73,
          transform: "rotate(-28deg)",
          width: cardSize,
        }}
      />
      <div
        style={{
          background: "linear-gradient(135deg, #D4C3A3 0%, #B8976C 100%)",
          border: `${size * 0.023}px solid #FBF9F5`,
          borderRadius: size * 0.1,
          bottom: cardOffset * 0.73,
          height: cardSize,
          position: "absolute",
          right: cardOffset,
          transform: "rotate(-28deg)",
          width: cardSize,
        }}
      />
      <div
        style={{
          color: "#6B573F",
          fontFamily: "Arial, sans-serif",
          fontSize: size * 0.445,
          fontWeight: 700,
          lineHeight: 1,
          position: "relative",
          textShadow: "0 2px 0 rgba(251, 249, 245, 0.45)",
          transform: `translateY(-${size * 0.01}px)`,
        }}
      >
        L
      </div>
    </div>
  );
}
