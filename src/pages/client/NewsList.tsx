import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, ArrowRight, Newspaper } from 'lucide-react';
import { clientApi } from '../../lib/client-api';

type NewsItem = {
  _id: string;
  title: string;
  subTitle?: string;
  slug: string;
  titleImageUrl?: string;
  createdAt: string;
  isPublished: boolean;
};

type NewsResponse = {
  items?: NewsItem[];
  total?: number;
  totalPages?: number;
  meta?: { total: number; page: number; limit: number; totalPages: number };
};

const PAGE_SIZE = 9;

export default function NewsList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') ?? '';
  const page = parseInt(searchParams.get('page') ?? '1', 10);

  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [localSearch, setLocalSearch] = useState(search);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(PAGE_SIZE));
    if (search) params.set('search', search);

    void clientApi
      .get<NewsResponse | NewsItem[]>(`/news/public/list?${params.toString()}`)
      .then((data) => {
        if (Array.isArray(data)) {
          setArticles(data);
          setTotal(data.length);
          setTotalPages(1);
        } else {
          setArticles(data.items ?? []);
          setTotal(data.meta?.total ?? data.total ?? 0);
          setTotalPages(data.meta?.totalPages ?? data.totalPages ?? 1);
        }
      })
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, [page, search]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setSearchParams(next);
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    updateParam('search', localSearch.trim());
  };

  return (
    <div className="client-surface min-h-[80vh]">
      {/* Hero */}
      <section style={{ background: '#1E3932' }} className="py-14">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.3em]" style={{ color: '#d4e9e2' }}>
            Tin tức & Kiến thức
          </p>
          <h1 className="text-4xl font-black text-white">Nông nghiệp hôm nay</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Cập nhật kiến thức nông nghiệp, kỹ thuật canh tác, và thông tin thị trường vật tư.
          </p>
          <form onSubmit={handleSearch} className="mx-auto mt-6 flex max-w-md gap-2">
            <input
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Tìm bài viết..."
              className="flex-1 rounded-full border-0 bg-white/10 px-5 py-3 text-sm text-white placeholder-white/50 outline-none focus:bg-white/15"
            />
            <button
              type="submit"
              className="client-pill-primary flex items-center gap-2 px-5 py-3 text-sm font-bold"
            >
              <Search size={16} />
            </button>
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-12 lg:px-6">
        {search && (
          <p className="mb-6 text-sm text-gray-500">
            Kết quả tìm kiếm: <strong>"{search}"</strong> — {total} bài viết
          </p>
        )}

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="client-card h-80 animate-pulse" />
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Newspaper size={48} className="mb-4 text-[#006241]/20" />
            <h2 className="font-black text-[#1E3932]">Chưa có bài viết</h2>
            <p className="mt-1 text-sm text-gray-400">
              {search ? 'Không tìm thấy bài viết phù hợp.' : 'Hãy quay lại sau.'}
            </p>
          </div>
        ) : (
          <>
            {/* Featured article (first one) */}
            {page === 1 && articles[0] && (
              <Link
                to={`/client/news/${articles[0].slug}`}
                className="client-card group mb-8 grid overflow-hidden transition-all md:grid-cols-2"
              >
                <div className="flex min-h-64 items-center justify-center overflow-hidden bg-[#eef6f1] md:min-h-80">
                  {articles[0].titleImageUrl ? (
                    <img
                      src={articles[0].titleImageUrl}
                      alt={articles[0].title}
                      className="h-64 w-full object-contain transition-transform duration-500 group-hover:scale-105 md:h-80"
                    />
                  ) : (
                    <div className="flex h-64 items-center justify-center md:h-80">
                      <span className="text-6xl">🌾</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col justify-center p-8">
                  <span className="mb-3 inline-block rounded-full bg-[#006241]/10 px-3 py-1 text-xs font-bold text-[#006241]">
                    Nổi bật
                  </span>
                  <h2 className="text-xl font-black leading-snug text-[#1E3932] group-hover:text-[#006241]">
                    {articles[0].title}
                  </h2>
                  {articles[0].subTitle && (
                    <p className="mt-2 line-clamp-3 text-sm text-gray-500">{articles[0].subTitle}</p>
                  )}
                  <p className="mt-3 text-xs text-gray-400">
                    {new Date(articles[0].createdAt).toLocaleDateString('vi-VN', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="mt-4 flex items-center gap-1 text-sm font-bold text-[#006241]">
                    Đọc bài viết <ArrowRight size={14} />
                  </p>
                </div>
              </Link>
            )}

            {/* Article grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {(page === 1 ? articles.slice(1) : articles).map((article, idx) => (
                <Link
                  key={article._id}
                  to={`/client/news/${article.slug}`}
                  className="client-card group overflow-hidden transition-all"
                >
                  <div className="flex h-48 items-center justify-center overflow-hidden bg-[#eef6f1]">
                    {article.titleImageUrl ? (
                      <img
                        src={article.titleImageUrl}
                        alt={article.title}
                        className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <span className="text-5xl">{['🌾', '🌿', '🚜', '💧', '🌱'][idx % 5]}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#006241]">
                      {new Date(article.createdAt).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                    <h3 className="line-clamp-2 font-bold leading-snug text-[#1E3932] group-hover:text-[#006241]">
                      {article.title}
                    </h3>
                    {article.subTitle && (
                      <p className="mt-2 line-clamp-2 text-sm text-gray-500">{article.subTitle}</p>
                    )}
                    <p className="mt-3 flex items-center gap-1 text-xs font-bold text-[#006241]">
                      Đọc tiếp <ArrowRight size={12} />
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => updateParam('page', String(page - 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => updateParam('page', String(p))}
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition ${
                      p === page ? 'text-white' : 'border border-black/10 bg-white text-[#1E3932]'
                    }`}
                    style={p === page ? { background: '#006241' } : {}}
                  >
                    {p}
                  </button>
                ))}
                <button
                  disabled={page >= totalPages}
                  onClick={() => updateParam('page', String(page + 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
