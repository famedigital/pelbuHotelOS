import { TodayStill } from "@/components/marketing/product-stills";

/** Same desk screen, scaled into each device so phone, tablet, and laptop match. */
function SameScreen({ width, height }: { width: number; height: number }) {
  const design = 920;
  const scale = width / design;
  return (
    <div className="overflow-hidden bg-[#f4f7fb]" style={{ width, height }}>
      <div
        style={{
          width: design,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <TodayStill />
      </div>
    </div>
  );
}

export function DeviceMockup() {
  return (
    <div className="relative mx-auto h-[540px] max-w-5xl">
      <div className="absolute top-0 left-1/2 w-[min(100%,720px)] -translate-x-1/2">
        <div className="rounded-t-2xl bg-[#d7d8dc] p-2.5 pb-0 shadow-[0_30px_60px_-28px_rgba(12,23,38,0.45)] ring-1 ring-black/10">
          <div className="relative overflow-hidden rounded-t-lg bg-black">
            <span className="absolute top-1.5 left-1/2 z-10 h-2 w-16 -translate-x-1/2 rounded-full bg-[#1a1a1a]" />
            <SameScreen width={700} height={390} />
          </div>
        </div>
        <div className="h-3 rounded-b-xl bg-gradient-to-b from-[#c5c6ca] to-[#b0b2b6]" />
        <div className="mx-auto h-2 w-40 rounded-b-md bg-[#9ea1a6]" />
      </div>

      <div className="absolute bottom-2 left-[2%] w-[210px] origin-bottom -rotate-[14deg]">
        <div className="rounded-[1.7rem] bg-[#e7e8ea] p-2 shadow-[0_24px_40px_-18px_rgba(12,23,38,0.55)] ring-1 ring-black/15">
          <div className="relative overflow-hidden rounded-[1.3rem] bg-black">
            <span className="absolute top-1.5 left-1/2 z-10 h-3.5 w-16 -translate-x-1/2 rounded-full bg-[#1a1a1a]" />
            <SameScreen width={186} height={380} />
          </div>
        </div>
      </div>

      <div className="absolute right-[1%] bottom-4 w-[250px]">
        <div className="rounded-[1.15rem] bg-[#e7e8ea] p-2 shadow-[0_24px_40px_-18px_rgba(12,23,38,0.5)] ring-1 ring-black/15">
          <div className="relative overflow-hidden rounded-[0.7rem] bg-black">
            <span className="absolute top-2 left-1/2 z-10 size-2 -translate-x-1/2 rounded-full bg-[#1a1a1a]" />
            <SameScreen width={234} height={320} />
          </div>
        </div>
      </div>
    </div>
  );
}
