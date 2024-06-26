import { AgGridReact } from "@ag-grid-community/react";
import type { SerializeFrom } from "@remix-run/node";
import {
  BabyCareAction,
  BabyCareEventType,
  type BabyCareEvent,
  type BabyCareProfile,
  type BottleFeedEvent,
  type DiaperChangeEvent,
  type NursingEvent,
  type PumpingEvent,
  type MeasurementEvent,
  type MedicineEvent,
  type NoteEvent,
  type TravelEvent,
  NotePurpose,
} from "../../data/BabyCare";
import { ClientSideRowModelModule } from "@ag-grid-community/client-side-row-model";
import { differenceInCalendarDays, format } from "date-fns";
import {
  AddIcon,
  BathIcon,
  BottleIcon,
  BreastPumpIcon,
  ChildToyIcon,
  FoodIcon,
  MeasurementIcon,
  MedicineIcon,
  MemoryIcon,
  MoreVertIcon,
  NoteIcon,
  NursingIcon,
  PeeIcon,
  PoopIcon,
  RemoveIcon,
  SleepIcon,
  TravelIcon,
  WarningIcon,
} from "../../shared/Icons";
import type { ICellRendererParams } from "@ag-grid-community/core";
import { useMemo, useState } from "react";
import { debounce } from "lodash-es";
import { cn } from "../../shared/StyleUtils";
import { useFetchers, useSubmit } from "@remix-run/react";
import { HttpMethod } from "../../shared/NetworkUtils";
import { BabyCareEventEditor } from "./BabyCareEventEditor";
import {
  guaranteeNonNullable,
  isNonNullable,
} from "../../shared/AssertionUtils";
import { pruneFormData } from "../../shared/FormDataUtils";
import { UNSPECIFIED_VALUE_TAG } from "../../data/constants";
import { computeNewValue } from "../../shared/NumberInput";
import { ClientOnly } from "remix-utils/client-only";

const InlineNumberInput = (props: {
  value: number;
  setValue: (value: number) => void;
  unit: string;
  min?: number;
  max?: number;
  step?: number;
  factor?: number;
  className?: string;
  children?: React.ReactNode;
  readOnly?: boolean | undefined;
}) => {
  const {
    min,
    max,
    step,
    unit,
    factor,
    value,
    setValue,
    className,
    children,
    readOnly,
  } = props;
  const _value = isNonNullable(value) ? value / (factor ?? 1) : undefined;
  const _setValue = (value: number) => {
    setValue(computeNewValue(value, min, max, step) * (factor ?? 1));
  };

  if (readOnly) {
    return (
      <div
        className={cn(
          "relative h-6 w-16 shrink-0 flex justify-center items-center text-slate-600 bg-slate-100 rounded",
          className
        )}
      >
        <div className="w-full h-full flex rounded justify-center items-center">
          {children}
          <div className="flex items-center font-mono text-xs">{_value}</div>
          <div className="flex items-center font-mono text-2xs ml-0.5">
            {unit}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative h-6 w-24 shrink-0 flex justify-center items-center text-slate-600 bg-slate-100 rounded",
        className
      )}
    >
      <button
        className="absolute h-full w-1/2 flex justify-start items-center pl-1 left-0"
        // NOTE: suppress double click row event of ag-grid, which we cannot stop propagation with React
        // since React wraps native event
        // See https://stackoverflow.com/a/63968681
        ref={(ref) => {
          if (!ref) {
            return;
          }
          ref.ondblclick = (e) => {
            e.stopPropagation();
          };
        }}
        onClick={() => _setValue((_value ?? 0) - (step ?? 1))}
      >
        <RemoveIcon className="text-2xs" />
      </button>
      <div className="w-full h-full flex rounded justify-center items-center">
        {children}
        <div className="flex items-center font-mono text-xs">{_value}</div>
        <div className="flex items-center font-mono text-2xs ml-0.5">
          {unit}
        </div>
      </div>
      <button
        className="absolute h-full w-1/2 flex justify-end items-center pr-1 right-0"
        // NOTE: suppress double click row event of ag-grid, which we cannot stop propagation with React
        // since React wraps native event
        // See https://stackoverflow.com/a/63968681
        ref={(ref) => {
          if (!ref) {
            return;
          }
          ref.ondblclick = (e) => {
            e.stopPropagation();
          };
        }}
        onClick={() => _setValue((_value ?? 0) + (step ?? 1))}
      >
        <AddIcon className="text-2xs" />
      </button>
    </div>
  );
};

const EventOverview = (props: {
  data: SerializeFrom<BabyCareEvent>;
  readOnly?: boolean | undefined;
}) => {
  const { data, readOnly } = props;

  const [volume, setVolume] = useState(
    (data as SerializeFrom<BottleFeedEvent | PumpingEvent>).volume
  );
  const [leftDuration, setLeftDuration] = useState(
    (data as SerializeFrom<NursingEvent>).leftDuration
  );
  const [rightDuration, setRightDuration] = useState(
    (data as SerializeFrom<NursingEvent>).rightDuration
  );
  const [height, setHeight] = useState(
    (data as SerializeFrom<MeasurementEvent>).height
  );
  const [weight, setWeight] = useState(
    (data as SerializeFrom<MeasurementEvent>).weight
  );

  const submit = useSubmit();
  const debouncedUpdate = useMemo(
    () =>
      debounce(
        (formData: {
          volume?: number | undefined;
          leftDuration?: number | undefined;
          rightDuration?: number | undefined;
          height?: number | undefined;
          weight?: number | undefined;
        }) => {
          let action: string;
          switch (data.TYPE) {
            case BabyCareEventType.BOTTLE_FEED: {
              action = BabyCareAction.UPDATE_BOTTLE_FEED_EVENT;
              break;
            }
            case BabyCareEventType.PUMPING: {
              action = BabyCareAction.UPDATE_PUMPING_EVENT;
              break;
            }
            case BabyCareEventType.NURSING: {
              action = BabyCareAction.UPDATE_NURSING_EVENT;
              break;
            }
            case BabyCareEventType.MEASUREMENT: {
              action = BabyCareAction.UPDATE_MEASUREMENT_EVENT;
              break;
            }
            default:
              return;
          }
          submit(
            pruneFormData({
              __action: action,
              ...data,
              volume: formData?.volume,
              leftDuration: formData?.leftDuration,
              rightDuration: formData?.rightDuration,
              height: formData?.height,
              weight: formData?.weight,
            }),
            { method: HttpMethod.POST }
          );
        },
        200
      ),
    [submit, data]
  );

  return (
    <>
      {(data.TYPE === BabyCareEventType.BOTTLE_FEED ||
        data.TYPE === BabyCareEventType.PUMPING) && (
        <InlineNumberInput
          readOnly={readOnly}
          min={0}
          max={1000}
          step={5}
          unit={"ml"}
          value={volume}
          setValue={(value) => {
            debouncedUpdate.cancel();
            setVolume(value);
            debouncedUpdate({ volume: value });
          }}
          className="mr-2"
        />
      )}
      {data.TYPE === BabyCareEventType.BOTTLE_FEED &&
        Boolean((data as SerializeFrom<BottleFeedEvent>).formulaMilkVolume) && (
          <div className="relative h-6 w-24 shrink-0 flex justify-center items-center text-slate-600 bg-slate-100 rounded">
            <div className="w-full h-full flex rounded justify-center items-center">
              <div className="flex items-center justify-center h-3 w-3 rounded-full text-4xs bg-slate-500 text-slate-100 font-bold mr-1">
                F
              </div>
              <div className="flex items-center font-mono text-xs">
                {(data as SerializeFrom<BottleFeedEvent>).formulaMilkVolume}
              </div>
              <div className="flex items-center font-mono text-2xs ml-0.5">
                ml
              </div>
            </div>
          </div>
        )}
      {data.TYPE === BabyCareEventType.NURSING && (
        <>
          <InlineNumberInput
            readOnly={readOnly}
            value={leftDuration}
            unit={"mn"}
            factor={60 * 1000}
            step={1}
            setValue={(value) => {
              debouncedUpdate.cancel();
              setLeftDuration(value);
              debouncedUpdate({ leftDuration: value, rightDuration });
            }}
            className="mr-2"
          >
            <div className="flex items-center justify-center h-3 w-3 rounded-full text-4xs bg-slate-500 text-slate-100 font-bold mr-1">
              L
            </div>
          </InlineNumberInput>
          <InlineNumberInput
            readOnly={readOnly}
            value={rightDuration}
            unit={"mn"}
            factor={60 * 1000}
            step={1}
            setValue={(value) => {
              debouncedUpdate.cancel();
              setRightDuration(value);
              debouncedUpdate({ leftDuration, rightDuration: value });
            }}
            className="mr-2"
          >
            <div className="flex items-center justify-center h-3 w-3 rounded-full text-4xs bg-slate-500 text-slate-100 font-bold mr-1">
              R
            </div>
          </InlineNumberInput>
        </>
      )}
      {data.TYPE === BabyCareEventType.MEASUREMENT && (
        <>
          <InlineNumberInput
            readOnly={readOnly}
            min={0}
            max={300}
            step={1}
            unit="cm"
            value={height ?? 0}
            setValue={(value) => {
              debouncedUpdate.cancel();
              setHeight(value);
              debouncedUpdate({ height: value, weight });
            }}
            className="mr-2"
          >
            <div className="flex items-center justify-center h-3 w-3 rounded-full text-4xs bg-slate-500 text-slate-100 font-bold mr-1">
              H
            </div>
          </InlineNumberInput>
          <InlineNumberInput
            readOnly={readOnly}
            min={0}
            max={100}
            step={0.1}
            unit="kg"
            value={weight ?? 0}
            setValue={(value) => {
              debouncedUpdate.cancel();
              setWeight(value);
              debouncedUpdate({ weight: value, height });
            }}
            className="mr-2"
          >
            <div className="flex items-center justify-center h-3 w-3 rounded-full text-4xs bg-slate-500 text-slate-100 font-bold mr-1">
              W
            </div>
          </InlineNumberInput>
        </>
      )}
      {data.TYPE === BabyCareEventType.MEDICINE &&
        (data as SerializeFrom<MedicineEvent>).prescription && (
          <div className="flex items-center rounded h-6 text-2xs text-slate-600 bg-indigo-100 px-2">
            {(data as SerializeFrom<MedicineEvent>).prescription ===
            UNSPECIFIED_VALUE_TAG ? (
              <div className="flex h-full">
                <div className="flex h-full items-center justify-center">
                  <WarningIcon className="flex text-lg text-indigo-300" />
                </div>
                <div className="flex h-full items-center ml-1 text-indigo-400">
                  [unspecified]
                </div>
              </div>
            ) : (
              (data as SerializeFrom<MedicineEvent>).prescription
            )}
          </div>
        )}
      {(
        [
          BabyCareEventType.NOTE,
          BabyCareEventType.__MEMORY,
          BabyCareEventType.__FOOD_FIRST_TRY,
        ] as string[]
      ).includes(data.TYPE) &&
        (data as SerializeFrom<NoteEvent>).title && (
          <div className="flex items-center rounded h-6 text-2xs text-slate-600 bg-indigo-100 px-2">
            {(data as SerializeFrom<NoteEvent>).title}
          </div>
        )}
      {data.TYPE === BabyCareEventType.TRAVEL &&
        (data as SerializeFrom<TravelEvent>).destination && (
          <>
            <ClientOnly>
              {() => (
                <div
                  className={
                    "relative h-6 w-16 shrink-0 flex justify-center items-center text-slate-600 bg-slate-100 rounded mr-2"
                  }
                >
                  <div className="w-full h-full flex rounded justify-center items-center">
                    <div className="flex items-center font-mono text-xs">
                      {differenceInCalendarDays(
                        (data as SerializeFrom<TravelEvent>).endTime,
                        (data as SerializeFrom<TravelEvent>).time
                      )}
                    </div>
                    <div className="flex items-center font-mono text-2xs ml-0.5">
                      day
                    </div>
                  </div>
                </div>
              )}
            </ClientOnly>
            <div className="flex items-center rounded h-6 text-2xs text-slate-600 bg-indigo-100 px-2">
              {(data as SerializeFrom<TravelEvent>).destination ===
              UNSPECIFIED_VALUE_TAG ? (
                <div className="flex h-full">
                  <div className="flex h-full items-center justify-center">
                    <WarningIcon className="flex text-lg text-indigo-300" />
                  </div>
                  <div className="flex h-full items-center ml-1 text-indigo-400">
                    [unspecified]
                  </div>
                </div>
              ) : (
                (data as SerializeFrom<TravelEvent>).destination
              )}
            </div>
          </>
        )}
    </>
  );
};

const EventOverviewDisplay = (
  params: ICellRendererParams<SerializeFrom<BabyCareEvent>> & {
    profile: SerializeFrom<BabyCareProfile>;
    pendingUpdateEvents: SerializeFrom<BabyCareEvent>[];
    setEventToEdit: (event: SerializeFrom<BabyCareEvent>) => void;
    readOnly?: boolean | undefined;
  }
) => {
  const data = params.data;

  if (!data) {
    return null;
  }
  return (
    <div className="flex items-center h-full w-full justify-between">
      <div className="flex items-center h-full w-full overflow-x-auto overflow-y-hidden">
        <EventOverview
          data={data}
          key={
            // NOTE: this will force re-mount components for pending events, and not causing janks
            // as we are taking advantage of optimistic UI, when latest data comes back, correction can be made
            // See https://twitter.com/remix_run/status/1744823043116216667
            params.pendingUpdateEvents.find(
              (pendingEvent) => pendingEvent.id === data.id
            )?.id === data.id
              ? data.HASH
              : data.id
          }
          readOnly={params.readOnly}
        />
        {data.comment && (
          <div className="flex items-center rounded h-6 text-2xs text-slate-600 bg-amber-100 px-2">
            {data.comment}
          </div>
        )}
      </div>
      <button
        className="flex items-center justify-center w-7 h-full"
        ref={(ref) => {
          if (!ref) {
            return;
          }
          ref.ondblclick = (e) => {
            e.stopPropagation();
          };
        }}
        onClick={() => params.setEventToEdit(data)}
      >
        <MoreVertIcon className="text-lg text-slate-300 hover:text-slate-500" />
      </button>
    </div>
  );
};

const EventTypeDisplay = (
  params: ICellRendererParams<SerializeFrom<BabyCareEvent>>
) => {
  const data = params.data;
  return (
    <div className="flex items-center h-full w-full">
      {data?.TYPE === BabyCareEventType.BOTTLE_FEED && (
        <BottleIcon className="h-full w-5 flex items-center text-base" />
      )}
      {data?.TYPE === BabyCareEventType.NURSING && (
        <NursingIcon className="h-full w-5 flex items-center text-base" />
      )}
      {data?.TYPE === BabyCareEventType.PUMPING && (
        <BreastPumpIcon className="h-full w-5 flex items-center text-base" />
      )}
      {data?.TYPE === BabyCareEventType.DIAPER_CHANGE &&
        ((data as SerializeFrom<DiaperChangeEvent>).poop ? (
          <PoopIcon className="h-full w-5 flex items-center text-base" />
        ) : (
          <PeeIcon className="h-full w-5 flex items-center text-base" />
        ))}
      {data?.TYPE === BabyCareEventType.SLEEP && (
        <SleepIcon className="h-full w-5 flex items-center text-base" />
      )}
      {data?.TYPE === BabyCareEventType.PLAY && (
        <ChildToyIcon className="h-full w-5 flex items-center text-base" />
      )}
      {data?.TYPE === BabyCareEventType.BATH && (
        <BathIcon className="h-full w-5 flex items-center text-base" />
      )}
      {data?.TYPE === BabyCareEventType.MEASUREMENT && (
        <MeasurementIcon className="h-full w-5 flex items-center text-base" />
      )}
      {data?.TYPE === BabyCareEventType.MEDICINE && (
        <MedicineIcon className="h-full w-5 flex items-center text-base" />
      )}
      {data?.TYPE === BabyCareEventType.NOTE &&
        ((data as SerializeFrom<NoteEvent>).purpose === NotePurpose.MEMORY ? (
          <MemoryIcon className="h-full w-5 flex items-center text-base" />
        ) : (data as SerializeFrom<NoteEvent>).purpose ===
          NotePurpose.FOOD_FIRST_TRY ? (
          <FoodIcon className="h-full w-5 flex items-center text-base" />
        ) : (
          <NoteIcon className="h-full w-5 flex items-center text-base" />
        ))}
      {data?.TYPE === BabyCareEventType.TRAVEL && (
        <TravelIcon className="h-full w-5 flex items-center text-base" />
      )}
      {data && (
        <div className="flex items-center justify-center rounded uppercase ml-1 text-3xs font-medium leading-4 bg-slate-500 px-1 text-slate-100">
          {data.TYPE === BabyCareEventType.DIAPER_CHANGE
            ? (data as SerializeFrom<DiaperChangeEvent>).poop
              ? BabyCareEventType.__POOP
              : BabyCareEventType.__PEE
            : data.TYPE === BabyCareEventType.NOTE
            ? (data as SerializeFrom<NoteEvent>).purpose === NotePurpose.MEMORY
              ? BabyCareEventType.__MEMORY
              : (data as SerializeFrom<NoteEvent>).purpose ===
                NotePurpose.FOOD_FIRST_TRY
              ? "Food"
              : BabyCareEventType.NOTE
            : data.TYPE}
        </div>
      )}
    </div>
  );
};

const EventTimeDisplay = (
  params: ICellRendererParams<SerializeFrom<BabyCareEvent>, Date> & {
    showDate?: boolean | undefined;
  }
) => {
  const time = params.value;
  if (!time) {
    return null;
  }
  return (
    <ClientOnly>
      {() =>
        format(new Date(time), params.showDate ? "MMM dd yyyy HH:mm" : "HH:mm")
      }
    </ClientOnly>
  );
};

const usePendingUpdatedEvents = () => {
  return useFetchers()
    .filter(
      (fetcher) =>
        fetcher.formData && fetcher.key === BabyCareAction.EDIT_GENERIC_EVENT
    )
    .map((fetcher) => {
      const formData = guaranteeNonNullable(fetcher.formData);
      return Object.fromEntries(
        formData.entries()
      ) as unknown as SerializeFrom<BabyCareEvent>;
    });
};

export const BabyCareEventGrid = (props: {
  profile: SerializeFrom<BabyCareProfile>;
  events: SerializeFrom<BabyCareEvent>[];
  // TODO?: consider merging/cleaning these flags since their usage are overlapping and unclear
  readOnly?: boolean | undefined;
  enableDialogEdit?: boolean | undefined;
  showDate?: boolean | undefined;
}) => {
  const { profile, events, readOnly, showDate, enableDialogEdit } = props;
  const [eventToEdit, setEventToEdit] = useState<
    SerializeFrom<BabyCareEvent> | undefined
  >(undefined);

  // used to render optimistic UI to reduce janks while editing
  // See https://twitter.com/remix_run/status/1744823043116216667
  const pendingUpdateEvents = usePendingUpdatedEvents();
  const mergedEvents = [...events];
  pendingUpdateEvents.forEach((pendingEvent) => {
    const matchingEvent = mergedEvents.find(
      (event) => event.id === pendingEvent.id
    );
    if (matchingEvent) {
      const idx = mergedEvents.indexOf(matchingEvent);
      mergedEvents[idx] = { ...matchingEvent, ...pendingEvent };
    }
  });

  return (
    <>
      <AgGridReact
        headerHeight={0}
        gridOptions={{
          getRowId: (data) => data.data.id,
          suppressCellFocus: true,
          onRowDoubleClicked: (event) => {
            setEventToEdit(event.data);
          },
          rowStyle: { cursor: "pointer" },
        }}
        columnDefs={[
          {
            headerName: "Time",
            field: "time",
            resizable: false,
            width: showDate ? 130 : 50,
            cellStyle: {
              textAlign: "center",
              fontSize: "12px",
            },
            suppressSizeToFit: true,
            cellClass: "text-slate-600 pr-0",
            cellRendererParams: {
              showDate,
            },
            cellRenderer: EventTimeDisplay,
          },
          {
            headerName: "Type",
            field: "HASH", // we send in the hash because the display type is computed based on multiple fields
            sortable: false,
            resizable: false,
            width: 75,
            cellClass: "px-0",
            suppressSizeToFit: true,
            cellRenderer: EventTypeDisplay,
          },
          {
            headerName: "Overview",
            field: "HASH",
            sortable: false,
            resizable: false,
            flex: 1,
            cellClass: "pr-0 pl-1",
            cellRendererParams: {
              profile,
              pendingUpdateEvents,
              setEventToEdit,
              readOnly,
            },
            cellRenderer: EventOverviewDisplay,
          },
        ]}
        rowData={mergedEvents}
        modules={[ClientSideRowModelModule]}
      />
      {eventToEdit && (
        <BabyCareEventEditor
          open={Boolean(eventToEdit)}
          onClose={() => setEventToEdit(undefined)}
          data={eventToEdit}
          profile={profile}
          readOnly={readOnly && !enableDialogEdit}
        />
      )}
    </>
  );
};
