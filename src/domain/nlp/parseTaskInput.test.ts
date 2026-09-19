import { parseTaskInput } from './parseTaskInput';

/** Friday, 18 September 2026, 10:00 local. */
const NOW = new Date(2026, 8, 18, 10, 0, 0, 0);

const p = (text: string, now: Date = NOW) => parseTaskInput(text, now);

describe('relative days', () => {
  it('bugün', () => {
    expect(p('bugün ilaç').date).toBe('2026-09-18');
  });
  it('yarın', () => {
    expect(p('yarın ilaç').date).toBe('2026-09-19');
  });
  it('öbür gün', () => {
    expect(p('öbür gün ilaç').date).toBe('2026-09-20');
  });
  it('ertesi gün', () => {
    expect(p('ertesi gün ilaç').date).toBe('2026-09-20');
  });
  it('bu akşam → 20:00 bugün', () => {
    const r = p('bu akşam markete git');
    expect(r.time).toBe('20:00');
    expect(r.date).toBe('2026-09-18');
  });
  it('bu gece → 22:00', () => {
    expect(p('bu gece kitap oku').time).toBe('22:00');
  });
  it('sabah → 09:00 (geçmiş olduğu için yarın)', () => {
    const r = p('sabah koş');
    expect(r.time).toBe('09:00');
    expect(r.date).toBe('2026-09-19');
  });
  it('öğlen → 12:30', () => {
    expect(p('öğlen yemek').time).toBe('12:30');
  });
  it('öğle → 12:30', () => {
    expect(p('öğle yemek').time).toBe('12:30');
  });
  it('öğleden sonra → 15:00', () => {
    expect(p('öğleden sonra toplantı').time).toBe('15:00');
  });
  it('akşam → 19:00', () => {
    expect(p('akşam spor').time).toBe('19:00');
  });
  it('gece → 22:00', () => {
    expect(p('gece ilaç').time).toBe('22:00');
  });
});

describe('weekday names', () => {
  it('pazartesi (sonraki pazartesi)', () => {
    expect(p('pazartesi toplantı').date).toBe('2026-09-21');
  });
  it('cuma günü → bir sonraki cuma', () => {
    expect(p('cuma günü rapor').date).toBe('2026-09-25');
  });
  it('salı', () => {
    expect(p('salı doktor').date).toBe('2026-09-22');
  });
  it('pazar', () => {
    expect(p('pazar kahvaltı').date).toBe('2026-09-20');
  });
  it('haftaya salı', () => {
    expect(p('haftaya salı toplantı').date).toBe('2026-09-22');
  });
  it('gelecek hafta → sonraki pazartesi', () => {
    expect(p('gelecek hafta rapor').date).toBe('2026-09-21');
  });
  it('gelecek hafta perşembe', () => {
    expect(p('gelecek hafta perşembe kontrol').date).toBe('2026-09-24');
  });
});

describe('clock times', () => {
  it("9'da", () => {
    expect(p("yarın 9'da ilaç").time).toBe('09:00');
  });
  it('9da', () => {
    expect(p('yarın 9da ilaç').time).toBe('09:00');
  });
  it('saat 9', () => {
    expect(p('yarın saat 9 ilaç').time).toBe('09:00');
  });
  it('09:30', () => {
    expect(p('yarın 09:30 ilaç').time).toBe('09:30');
  });
  it('9.30', () => {
    expect(p('yarın 9.30 ilaç').time).toBe('09:30');
  });
  it('21:15', () => {
    expect(p('yarın 21:15 ilaç').time).toBe('21:15');
  });
  it('sabah 9', () => {
    expect(p('yarın sabah 9 koş').time).toBe('09:00');
  });
  it('akşam 7 → 19:00', () => {
    expect(p('yarın akşam 7 spor').time).toBe('19:00');
  });
  it('öğleden sonra 3 → 15:00', () => {
    expect(p('yarın öğleden sonra 3 toplantı').time).toBe('15:00');
  });
  it('9 buçuk → 09:30', () => {
    expect(p('yarın 9 buçuk ilaç').time).toBe('09:30');
  });
  it('akşam 8 buçuk → 20:30', () => {
    expect(p('yarın akşam 8 buçuk yemek').time).toBe('20:30');
  });
  it("saat 14'te", () => {
    expect(p("yarın saat 14'te toplantı").time).toBe('14:00');
  });
  it("18'de", () => {
    expect(p("yarın 18'de spor").time).toBe('18:00');
  });
  it("'ye eki (7 → sabah kuralı)", () => {
    expect(p("yarın 7'ye kadar rapor").time).toBe('07:00');
  });
});

describe('ambiguous hour rule', () => {
  it('7 → sabah (07:00)', () => {
    expect(p("yarın 7'de koş").time).toBe('07:00');
  });
  it('11 → sabah (11:00)', () => {
    expect(p("yarın 11'de toplantı").time).toBe('11:00');
  });
  it('3 → öğleden sonra (15:00)', () => {
    expect(p("yarın 3'te toplantı").time).toBe('15:00');
  });
  it('6 → öğleden sonra (18:00)', () => {
    expect(p("yarın 6'da spor").time).toBe('18:00');
  });
  it('1 → öğleden sonra (13:00)', () => {
    expect(p("yarın 1'de yemek").time).toBe('13:00');
  });
  it('12 → öğle (12:00)', () => {
    expect(p("yarın 12'de yemek").time).toBe('12:00');
  });
  it('24 → gece yarısı (00:00)', () => {
    expect(p("yarın 24'te bitir").time).toBe('00:00');
  });
  it('sabah 3 → 03:00 (açık sabah önceliklidir)', () => {
    expect(p('yarın sabah 3 uyan').time).toBe('03:00');
  });
  it('akşam 11 → 23:00 (açık akşam önceliklidir)', () => {
    expect(p('yarın akşam 11 kitap').time).toBe('23:00');
  });
  it('gece 2 → 02:00', () => {
    expect(p('yarın gece 2 kontrol').time).toBe('02:00');
  });
});

describe('relative delays', () => {
  it('15 dk sonra', () => {
    const r = p('15 dk sonra çay');
    expect(r.time).toBe('10:15');
    expect(r.date).toBe('2026-09-18');
  });
  it('15 dakika sonra', () => {
    expect(p('15 dakika sonra çay').time).toBe('10:15');
  });
  it('2 saat sonra', () => {
    expect(p('2 saat sonra ara').time).toBe('12:00');
  });
  it('yarım saat sonra', () => {
    expect(p('yarım saat sonra ara').time).toBe('10:30');
  });
  it('3 gün sonra', () => {
    expect(p('3 gün sonra kontrol').date).toBe('2026-09-21');
  });
});

describe('explicit dates', () => {
  it('12 ekim', () => {
    expect(p('12 ekim fatura').date).toBe('2026-10-12');
  });
  it("12 Ekim'de", () => {
    expect(p("12 Ekim'de fatura").date).toBe('2026-10-12');
  });
  it('3 mart → gelecek yıl (geçmiş tarih)', () => {
    expect(p('3 mart doğum günü').date).toBe('2027-03-03');
  });
  it('12/10/2026', () => {
    expect(p('12/10/2026 fatura').date).toBe('2026-10-12');
  });
  it('12/10 → bu yıl', () => {
    expect(p('12/10 fatura').date).toBe('2026-10-12');
  });
  it('1 aralık', () => {
    expect(p('1 aralık kira').date).toBe('2026-12-01');
  });
  it('29 şubat olmayan yılda 28 şubata düşmez (tarih olarak kalır)', () => {
    expect(p('15 şubat kontrol').date).toBe('2027-02-15');
  });
});

describe('recurrence', () => {
  it('her gün', () => {
    expect(p('her gün vitamin').rule).toEqual({ freq: 'daily' });
  });
  it("her sabah 8'de", () => {
    const r = p("her sabah 8'de vitamin");
    expect(r.rule).toEqual({ freq: 'daily' });
    expect(r.time).toBe('08:00');
  });
  it('her sabah (saatsiz) → 09:00', () => {
    const r = p('her sabah koş');
    expect(r.rule).toEqual({ freq: 'daily' });
    expect(r.time).toBe('09:00');
  });
  it('hafta içi', () => {
    expect(p('hafta içi koş').rule).toEqual({ freq: 'weekly', weekdays: [1, 2, 3, 4, 5] });
  });
  it('hafta sonu', () => {
    expect(p('hafta sonu temizlik').rule).toEqual({ freq: 'weekly', weekdays: [6, 7] });
  });
  it('her pazartesi', () => {
    expect(p('her pazartesi çöp').rule).toEqual({ freq: 'weekly', weekdays: [1] });
  });
  it('her pazartesi ve perşembe', () => {
    expect(p('her pazartesi ve perşembe spor').rule).toEqual({
      freq: 'weekly',
      weekdays: [1, 4],
    });
  });
  it('iki haftada bir', () => {
    const r = p('iki haftada bir sulama');
    expect(r.rule?.freq).toBe('weekly');
    expect((r.rule as { interval?: number }).interval).toBe(2);
  });
  it('3 günde bir', () => {
    expect(p('3 günde bir sulama').rule).toEqual({ freq: 'daily', interval: 3 });
  });
  it("her ayın 5'i", () => {
    expect(p("her ayın 5'i kira").rule).toEqual({ freq: 'monthlyDay', day: 5 });
  });
  it('ayın son günü', () => {
    expect(p('ayın son günü fatura').rule).toEqual({ freq: 'monthlyLastDay' });
  });
  it('her ayın son günü', () => {
    expect(p('her ayın son günü fatura').rule).toEqual({ freq: 'monthlyLastDay' });
  });
  it('her yıl 3 mart', () => {
    expect(p('her yıl 3 mart doğum günü').rule).toEqual({ freq: 'yearly', month: 3, day: 3 });
  });
  it('tekrarlayan görevin başlangıç tarihi bugündür', () => {
    expect(p('her gün vitamin').date).toBe('2026-09-18');
  });
});

describe('reminder type', () => {
  it('alarm kelimesi alarma çevirir', () => {
    expect(p("yarın 7'de alarm kalk").reminderType).toBe('alarm');
  });
  it('alarmlı kelimesi alarma çevirir', () => {
    expect(p("yarın 7'de alarmlı kalk").reminderType).toBe('alarm');
  });
  it('saat varsa varsayılan bildirimdir', () => {
    expect(p("yarın 9'da ilaç").reminderType).toBe('notification');
  });
  it('saat yoksa hatırlatma tipi yoktur', () => {
    expect(p('markete git').reminderType).toBeUndefined();
  });
  it('bildirim kelimesi bildirime çevirir', () => {
    expect(p('yarın bildirim rapor').reminderType).toBe('notification');
  });
});

describe('title cleanup', () => {
  it('ayrıştırılan ifadeler başlıktan çıkarılır', () => {
    expect(p("yarın 9'da ilaç").title).toBe('İlaç');
  });
  it('büyük İ doğru üretilir', () => {
    expect(p('yarın ilaç iç').title).toBe('İlaç iç');
  });
  it('tekrar ifadesi başlıktan çıkarılır', () => {
    expect(p("her sabah 8'de vitamin al").title).toBe('Vitamin al');
  });
  it('alarm kelimesi başlıktan çıkarılır', () => {
    expect(p("yarın 7'de alarm kalk").title).toBe('Kalk');
  });
  it('sadece başlık verildiğinde olduğu gibi kalır', () => {
    const r = p('annemi ara');
    expect(r.title).toBe('Annemi ara');
    expect(r.date).toBeUndefined();
    expect(r.time).toBeUndefined();
  });
  it('baştaki ve sondaki noktalama temizlenir', () => {
    expect(p('yarın, ilaç.').title).toBe('İlaç');
  });
  it('boş girdi boş başlık verir', () => {
    expect(p('').title).toBe('');
  });
});

describe('spans', () => {
  it('her ayrıştırılan parça için bir span üretilir', () => {
    const r = p("yarın 9'da alarm ilaç");
    const kinds = r.spans.map((s) => s.kind).sort();
    expect(kinds).toEqual(['date', 'reminder', 'time']);
  });
  it("span'ler örtüşmez", () => {
    const r = p("her sabah 8'de vitamin");
    const sorted = [...r.spans].sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]!.start).toBeGreaterThanOrEqual(sorted[i - 1]!.end);
    }
  });
  it('span metni orijinal girdiden alınır', () => {
    const r = p('yarın ilaç');
    expect(r.spans[0]!.text).toBe('yarın');
  });
});

describe('time without a day', () => {
  it('saat geçmişse yarına kayar', () => {
    const r = p("9'da ilaç"); // now = 10:00
    expect(r.date).toBe('2026-09-19');
  });
  it('saat ileriyse bugün kalır', () => {
    const r = p("15'te toplantı");
    expect(r.date).toBe('2026-09-18');
  });
});

describe('combinations', () => {
  it('tarih + saat + alarm', () => {
    const r = p('12 ekim 14:30 alarm doktor randevusu');
    expect(r.date).toBe('2026-10-12');
    expect(r.time).toBe('14:30');
    expect(r.reminderType).toBe('alarm');
    expect(r.title).toBe('Doktor randevusu');
  });
  it('tekrar + saat + alarm', () => {
    const r = p('hafta içi 6:30 alarm kalk');
    expect(r.rule).toEqual({ freq: 'weekly', weekdays: [1, 2, 3, 4, 5] });
    expect(r.time).toBe('06:30');
    expect(r.reminderType).toBe('alarm');
    expect(r.title).toBe('Kalk');
  });
  it('gün adı + saat', () => {
    const r = p('cuma 18:00 sinema');
    expect(r.date).toBe('2026-09-25');
    expect(r.time).toBe('18:00');
    expect(r.title).toBe('Sinema');
  });
});
