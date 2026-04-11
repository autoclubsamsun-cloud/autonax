'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Randevu, PPFUrun, SeramikUrun, DigerHizmet, Bayi, Personel, EDMAyar, OdemeAyar, SiteAyarlar } from '../types';
import { RANDEVULAR_DEMO } from '../data/randevular';
import { URUNLER, SERAMIK, DIGER_HIZMETLER, KATEGORILER } from '../data/urunler';
import { BAYILER_DEMO } from '../data/bayiler';
import { PERSONEL_DEMO } from '../data/personel';
import { storageGet, storageSet, STORAGE_KEYS } from '../utils/storage';

/** Central store — localStorage backed */
export function useStore() {
  const [randevular, setRandevularState] = useState<Randevu[]>([]);
  const [urunler, setUrunlerState] = useState<Record<string, PPFUrun>>(URUNLER);
  const [seramik, setSeramikState] = useState<SeramikUrun[]>(SERAMIK);
  const [digerHizmetler, setDigerHizmetlerState] = useState<DigerHizmet[]>(DIGER_HIZMETLER);
  const [bayiler, setBayilerState] = useState<Bayi[]>([]);
  const [personel, setPersonelState] = useState<Personel[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Initialize from localStorage or demo data
  useEffect(() => {
    const rdv = storageGet<Randevu[]>(STORAGE_KEYS.RANDEVULAR) ?? RANDEVULAR_DEMO;
    const ur  = storageGet<Record<string, PPFUrun>>(STORAGE_KEYS.URUNLER) ?? URUNLER;
    const bay = storageGet<Bayi[]>(STORAGE_KEYS.BAYILER) ?? BAYILER_DEMO;
    const per = storageGet<Personel[]>(STORAGE_KEYS.PERSONEL) ?? PERSONEL_DEMO;

    setRandevularState(rdv);
    setUrunlerState(ur);
    setBayilerState(bay);
    setPersonelState(per);
    setLoaded(true);
  }, []);

  const setRandevular = useCallback((rdv: Randevu[]) => {
    setRandevularState(rdv);
    storageSet(STORAGE_KEYS.RANDEVULAR, rdv);
  }, []);

  const setUrunler = useCallback((ur: Record<string, PPFUrun>) => {
    setUrunlerState(ur);
    storageSet(STORAGE_KEYS.URUNLER, ur);
  }, []);

  const setBayiler = useCallback((bay: Bayi[]) => {
    setBayilerState(bay);
    storageSet(STORAGE_KEYS.BAYILER, bay);
  }, []);

  const setPersonel = useCallback((per: Personel[]) => {
    setPersonelState(per);
    storageSet(STORAGE_KEYS.PERSONEL, per);
  }, []);

  return {
    loaded,
    randevular, setRandevular,
    urunler, setUrunler,
    seramik, setSeramikState,
    digerHizmetler, setDigerHizmetlerState,
    bayiler, setBayiler,
    personel, setPersonel,
    kategoriler: KATEGORILER,
  };
}

export type Store = ReturnType<typeof useStore>;
