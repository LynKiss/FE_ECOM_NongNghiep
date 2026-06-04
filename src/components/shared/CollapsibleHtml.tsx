import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

type Props = {
  html: string;
  collapsedHeight?: number;
  contentClassName?: string;
};

export default function CollapsibleHtml({ html, collapsedHeight = 340, contentClassName = '' }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    const measure = () => {
      const h = el.scrollHeight;
      setOverflows(h > collapsedHeight + 48);
    };

    measure();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(measure)
        : null;
    resizeObserver?.observe(el);

    const images = Array.from(el.querySelectorAll('img')) as HTMLImageElement[];
    images.forEach((image) => {
      image.addEventListener('load', measure);
      image.addEventListener('error', measure);
    });

    return () => {
      resizeObserver?.disconnect();
      images.forEach((image) => {
        image.removeEventListener('load', measure);
        image.removeEventListener('error', measure);
      });
    };
  }, [html, collapsedHeight]);

  const maxHeight = overflows
    ? expanded
      ? undefined
      : collapsedHeight
    : undefined;

  return (
    <div className="relative">
      <div
        className="overflow-hidden"
        style={{ maxHeight, transition: 'max-height 0.4s ease' }}
      >
        <div
          ref={innerRef}
          className={contentClassName}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>

      {overflows && !expanded && (
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-white to-transparent" />
      )}

      {overflows && (
        <div className="relative mt-4 flex justify-center">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-6 py-2.5 text-sm font-bold text-gray-700 shadow-sm transition hover:border-green-400 hover:text-green-600 hover:shadow-md"
          >
            {expanded
              ? <><ChevronUp size={15} /> Thu gọn</>
              : <><ChevronDown size={15} /> Xem thêm</>
            }
          </button>
        </div>
      )}
    </div>
  );
}
