import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import ClockHandler from "../handlers/ClockHandler";

type ProviderProps = {
  children: ReactNode;
};

type ContextValue = {
  inActivity: boolean;
  reports: { reachedEnd: boolean; data: TReport[] };
  addCheckpoint: () => void;
  orderMoreReports: () => void;
  replaceReport: (report: TReport) => void;
};

const REPORTS_ORDER_AMOUNT = 5;
const MID_NIGHT_REFRESH_DELAY = 100;

/**
 * Contexto que mantém o estado das batidas e históricos, se
 * mantém sincronizado com o localStorage via a classe ClockHandler
 */
const ClockContext = createContext<ContextValue | undefined>(undefined);

const clockHandler = new ClockHandler();

const ClockContextProvider = ({ children }: ProviderProps) => {
  const [reports, setReports] = useState(() => {
    const data = clockHandler.getReports(0, REPORTS_ORDER_AMOUNT);
    const reachedEnd = data.length < REPORTS_ORDER_AMOUNT;
    return { reachedEnd, data };
  });

  const inActivity = useMemo(
    () => reports.data[0].checkpoints.length % 2 !== 0,
    [reports.data],
  );

  const _midNightTimeout = useRef<null | number>(null);

  const addCheckpoint = () => {
    const updatedReport = clockHandler.addCheckpoint(new Date());
    setReports((prev) => ({
      ...prev,
      data: prev.data.map((rp) =>
        rp.id === updatedReport.id ? updatedReport : rp,
      ),
    }));
  };

  const replaceReport = (report: TReport) => {
    clockHandler.replaceReport(report);
    setReports((prev) => {
      return {
        reachedEnd: prev.reachedEnd,
        data: prev.data.map((rp) => {
          if (rp.id === report.id) return { ...report };
          return rp;
        }),
      };
    });
  };

  const orderMoreReports = () => {
    if (reports.reachedEnd) return;
    setReports((prev) => {
      const newReports = clockHandler.getReports(
        prev.data.length,
        REPORTS_ORDER_AMOUNT,
      );
      const reachedEnd = newReports.length < REPORTS_ORDER_AMOUNT;
      return {
        reachedEnd,
        data: [...prev.data, ...newReports],
      };
    });
  };

  const _getDifferenceToMidNight = () => {
    const nowDate = new Date();
    const midNightDate = new Date();
    midNightDate.setHours(0, 0, 0, 0);
    midNightDate.setDate(midNightDate.getDate() + 1);
    return midNightDate.getTime() - nowDate.getTime() + MID_NIGHT_REFRESH_DELAY;
  };

  const _midNightRefresh = () => {
    clockHandler.refresh();
    setReports((prev) => {
      const [todayReport, yesterdayReport] = clockHandler.getReports(0, 2);
      const updatedReports = [...prev.data];
      updatedReports[0] = todayReport;
      updatedReports[1] = yesterdayReport;
      updatedReports.pop();
      return { reachedEnd: prev.reachedEnd, data: updatedReports };
    });
    _midNightTimeout.current = setTimeout(
      _midNightRefresh,
      _getDifferenceToMidNight(),
    );
  };

  useEffect(() => {
    _midNightTimeout.current = setTimeout(
      _midNightRefresh,
      _getDifferenceToMidNight(),
    );
    return () => {
      if (_midNightTimeout.current) {
        clearTimeout(_midNightTimeout.current);
        _midNightTimeout.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ClockContext
      value={{
        inActivity,
        reports,
        addCheckpoint,
        orderMoreReports,
        replaceReport,
      }}
    >
      {children}
    </ClockContext>
  );
};

const useClockContext = () => {
  const ctx = useContext(ClockContext);
  if (ctx === undefined) throw new Error("ClockContext not found");
  return ctx;
};

// eslint-disable-next-line react-refresh/only-export-components
export { ClockContextProvider, useClockContext };
