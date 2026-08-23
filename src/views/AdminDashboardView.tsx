import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BarChart3, CheckCircle2, Eye, Layers, MessageSquare, ShieldCheck, Trash2, Users, XCircle } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { PendingPlace, Review, Place } from '../types';
import { AdminPlacesView } from './AdminPlacesView';

type AdminTab = 'overview' | 'places' | 'pending' | 'reviews';

type AdminStats = {
  totalPlaces?: number;
  pendingSubmissions?: number;
  totalReviews?: number;
  totalUsers?: number;
  regionalStats?: { north?: number; central?: number; northeast?: number; south?: number };
};

const tabBase = 'px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap';

export const AdminDashboardView: React.FC = () => {
  const { t, lang, showToast, setSelectedPlaceId } = useApp();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [pendingList, setPendingList] = useState<PendingPlace[]>([]);
  const [reviewsList, setReviewsList] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [statsData, placesData, submissionsData, reviewsData] = await Promise.all([
          api.getAdminStats(),
          api.getPlaces(),
          api.getSubmissions(),
          api.getReviews(),
        ]);
        if (cancelled) return;
        setStats(statsData);
        setPlaces(placesData.places || []);
        setPendingList(submissionsData || []);
        setReviewsList(reviewsData || []);
      } catch (error: any) {
        if (cancelled) return;
        const message = error?.message || 'Failed to load admin data';
        console.error('Failed to load admin data:', error);
        setLoadError(message);
        showToast(`โหลดข้อมูล Admin ไม่สำเร็จ: ${message}`, 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadData();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const refreshData = () => setReloadKey((value) => value + 1);
  const pendingCount = useMemo(() => pendingList.filter((item) => item.status === 'pending').length, [pendingList]);
  const totalPlaces = stats?.totalPlaces ?? places.length;
  const totalReviews = stats?.totalReviews ?? reviewsList.length;
  const totalUsers = stats?.totalUsers ?? 0;
  const pendingTotal = stats?.pendingSubmissions ?? pendingCount;

  const chartData = useMemo(() => [
    { name: lang === 'th' ? 'เหนือ' : lang === 'zh' ? '北部' : 'North', count: stats?.regionalStats?.north || 0 },
    { name: lang === 'th' ? 'กลาง' : lang === 'zh' ? '中部' : 'Central', count: stats?.regionalStats?.central || 0 },
    { name: lang === 'th' ? 'อีสาน' : lang === 'zh' ? '东北部' : 'Northeast', count: stats?.regionalStats?.northeast || 0 },
    { name: lang === 'th' ? 'ใต้' : lang === 'zh' ? '南部' : 'South', count: stats?.regionalStats?.south || 0 },
  ], [lang, stats]);

  const handleApproveSubmission = async (id: string) => {
    try {
      const result = await api.approveSubmission(id);
      showToast(`อนุมัติ ${result.place?.name?.th || 'สถานที่'} เรียบร้อยแล้ว`, 'success');
      refreshData();
    } catch (error: any) {
      console.error('Approve failed:', error);
      showToast(`อนุมัติสถานที่ไม่สำเร็จ: ${error?.message || ''}`, 'error');
    }
  };

  const handleRejectSubmission = async (id: string) => {
    try {
      await api.rejectSubmission(id);
      showToast('ปฏิเสธคำขอเรียบร้อยแล้ว', 'success');
      refreshData();
    } catch (error: any) {
      console.error('Reject failed:', error);
      showToast(`ปฏิเสธคำขอไม่สำเร็จ: ${error?.message || ''}`, 'error');
    }
  };

  const handleDeleteReview = async (id: string) => {
    if (!window.confirm('ต้องการลบรีวิวนี้หรือไม่?')) return;
    try {
      await api.deleteReview(id);
      showToast('ลบรีวิวเรียบร้อยแล้ว', 'success');
      refreshData();
    } catch (error: any) {
      console.error('Delete review failed:', error);
      showToast(`ลบรีวิวไม่สำเร็จ: ${error?.message || ''}`, 'error');
    }
  };

  return (
    <div id="admin-dashboard-view" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 shrink-0 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700"><ShieldCheck className="w-7 h-7" /></div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap"><h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{t('admin.dashboard')}</h1><span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold uppercase">Admin Panel</span></div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">Thai Smart Trip Content Management & Moderation Center</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 border border-slate-200 overflow-x-auto max-w-full">
          <button type="button" onClick={() => setActiveTab('overview')} className={`${tabBase} ${activeTab === 'overview' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>แดชบอร์ดภาพรวม</button>
          <button type="button" onClick={() => setActiveTab('places')} className={`${tabBase} ${activeTab === 'places' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>จัดการสถานที่ท่องเที่ยว ({places.length})</button>
          <button type="button" onClick={() => setActiveTab('pending')} className={`${tabBase} relative ${activeTab === 'pending' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>คำขออนุมัติสถานที่{pendingCount > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] leading-none">{pendingCount}</span>}</button>
          <button type="button" onClick={() => setActiveTab('reviews')} className={`${tabBase} ${activeTab === 'reviews' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>จัดการรีวิว ({reviewsList.length})</button>
        </div>
      </div>

      {loadError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1"><p className="font-bold text-rose-800">โหลดข้อมูล Admin ไม่สำเร็จ</p><p className="text-sm text-rose-700 break-words mt-1">{loadError}</p></div>
          <button type="button" onClick={refreshData} className="px-3 py-1.5 rounded-xl bg-white border border-rose-200 text-rose-700 text-xs font-bold">ลองใหม่</button>
        </div>
      )}

      {loading && activeTab !== 'places' && <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-sm text-slate-500">กำลังตรวจสอบสิทธิ์และโหลดข้อมูล Admin...</div>}

      {!loading && activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm"><div className="flex items-center justify-between text-slate-500"><span className="text-xs font-semibold uppercase">สถานที่ทั้งหมด</span><Layers className="w-5 h-5 text-emerald-600" /></div><p className="text-3xl font-extrabold text-slate-900 mt-2">{totalPlaces}</p><p className="text-xs text-emerald-700 mt-1">ฐานข้อมูลสถานที่ท่องเที่ยว</p></div>
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm"><div className="flex items-center justify-between text-slate-500"><span className="text-xs font-semibold uppercase">รออนุมัติ</span><AlertCircle className="w-5 h-5 text-amber-500" /></div><p className="text-3xl font-extrabold text-amber-600 mt-2">{pendingTotal}</p><p className="text-xs text-slate-500 mt-1">คำขอเพิ่มสถานที่ใหม่</p></div>
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm"><div className="flex items-center justify-between text-slate-500"><span className="text-xs font-semibold uppercase">รีวิวทั้งหมด</span><MessageSquare className="w-5 h-5 text-teal-600" /></div><p className="text-3xl font-extrabold text-teal-700 mt-2">{totalReviews}</p><p className="text-xs text-slate-500 mt-1">รีวิวและคะแนนจากสมาชิก</p></div>
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm"><div className="flex items-center justify-between text-slate-500"><span className="text-xs font-semibold uppercase">สมาชิก</span><Users className="w-5 h-5 text-rose-500" /></div><p className="text-3xl font-extrabold text-rose-600 mt-2">{totalUsers}</p><p className="text-xs text-slate-500 mt-1">Registered member profiles</p></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm"><h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4"><BarChart3 className="w-4 h-4 text-emerald-700" />จำนวนสถานที่แยกตามภูมิภาค</h3><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" fontSize={12} /><YAxis allowDecimals={false} fontSize={12} /><Tooltip /><Bar dataKey="count" fill="#10B981" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3"><h3 className="text-base font-bold text-slate-900">สถานะระบบ</h3><div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100"><p className="text-xs text-slate-500">Database</p><p className="font-bold text-emerald-700 mt-1">JSON Storage · {totalPlaces} Places</p></div><div className="p-4 rounded-2xl bg-slate-50 border border-slate-200"><p className="text-xs text-slate-500">Languages</p><p className="font-bold text-slate-800 mt-1">TH / EN / ZH</p></div><div className="p-4 rounded-2xl bg-slate-50 border border-slate-200"><p className="text-xs text-slate-500">Admin Session</p><p className="font-bold text-emerald-700 mt-1">Authenticated · Firebase ID Token</p></div></div>
          </div>
        </div>
      )}

      {activeTab === 'places' && <AdminPlacesView />}

      {!loading && activeTab === 'pending' && (
        <div className="space-y-4">
          {pendingCount === 0 ? <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center"><CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" /><p className="font-bold text-slate-900 mt-3">ไม่มีคำขอที่รออนุมัติ</p><p className="text-sm text-slate-500 mt-1">ทุกคำขอได้รับการจัดการแล้ว</p></div> : <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">{pendingList.filter((item) => item.status === 'pending').map((item) => <div key={item.id} className="bg-white border border-amber-300 rounded-3xl p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="inline-flex px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold">PENDING</span><h3 className="font-extrabold text-slate-900 mt-2">{item.name?.th || item.name?.en || 'สถานที่ใหม่'}</h3><p className="text-sm text-slate-500 mt-1">{item.province?.th || item.province?.en || '-'}</p></div><Eye className="w-5 h-5 text-slate-400 shrink-0" /></div><div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-600 space-y-1"><p><span className="font-semibold">ผู้ส่ง:</span> {item.submittedBy?.name || item.submittedBy?.email || '-'}</p><p><span className="font-semibold">หมวดหมู่:</span> {item.categoryId || '-'}</p><p><span className="font-semibold">Google Maps:</span> {item.googleMapsUrl ? 'มีลิงก์' : 'ไม่มีลิงก์'}</p></div><div className="mt-4 flex gap-2"><button type="button" onClick={() => handleApproveSubmission(item.id)} className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4" />อนุมัติ</button><button type="button" onClick={() => handleRejectSubmission(item.id)} className="flex-1 py-2.5 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center justify-center gap-2"><XCircle className="w-4 h-4" />ปฏิเสธ</button></div></div>)}</div>}
        </div>
      )}

      {!loading && activeTab === 'reviews' && (
        <div className="space-y-4">
          {reviewsList.length === 0 ? <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-500">ยังไม่มีรีวิว</div> : <div className="space-y-3">{reviewsList.map((review) => <div key={review.id} className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row gap-4 sm:items-center justify-between"><div className="min-w-0"><div className="flex items-center gap-2 flex-wrap"><span className="font-bold text-slate-900">{review.userName || 'Member'}</span><span className="text-amber-500 font-bold">★ {review.rating || 0}</span></div><p className="text-sm text-slate-700 mt-2 break-words">{review.comment || '-'}</p><p className="text-xs text-slate-400 mt-2">Place ID: {review.placeId}</p></div><div className="flex gap-2 shrink-0"><button type="button" onClick={() => setSelectedPlaceId(Number(review.placeId))} className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1"><Eye className="w-4 h-4" />ดูสถานที่</button><button type="button" onClick={() => handleDeleteReview(String(review.id))} className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1"><Trash2 className="w-4 h-4" />ลบ</button></div></div>)}</div>}
        </div>
      )}
    </div>
  );
};