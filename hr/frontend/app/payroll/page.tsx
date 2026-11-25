"use client";

import HRISSidebar from "@/components/HRISSidebar";
import { useEffect, useRef, useState } from "react";
import "./payroll.css";

const API = "http://127.0.0.1:8000";

type Employee = {
  employee_id: number;
  first_name: string;
  last_name: string;
};

type Payroll = {
  payroll_id: number;
  employee_id: number;
  employee_name: string;
  basic_salary: number;
  pay_period: string;
  overtime: number;
  gross_salary: number;
  sss: number;
  philhealth: number;
  pag_ibig: number;
  deductions: number;
  net_salary: number;
  "13th_month_pay": number;
  payroll_status: string;
  payment_date: string | null;

  present_days?: number;
  absent_days?: number;
  late_days?: number;
  leave_days?: number;
  attendance_deduction?: number;

  period_basic_salary?: number;
  period_days?: number;
};

type PayrollForm = {
  employee_id: string;
  basic_salary: string;
  semi_monthly_basic_salary: string;
  pay_period: string;
  overtime: string;

  present_days: string;
  absent_days: string;
  late_days: string;
  attendance_deduction: string;

  gross_salary: string;
  sss: string;
  philhealth: string;
  pag_ibig: string;
  deductions: string;
  net_salary: string;

  thirteenth_month_pay: string;
  payroll_status: string;
  payment_date: string;
};

export default function PayrollPage() {
  const [payroll, setPayroll] = useState<Payroll[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] =
    useState(false);

  const [currentDate, setCurrentDate] = useState("");

  /*
   * PAY PERIOD CALENDAR
   */
  const [showPayPeriodCalendar, setShowPayPeriodCalendar] =
    useState(false);

  const [payPeriodStart, setPayPeriodStart] = useState("");
  const [payPeriodEnd, setPayPeriodEnd] = useState("");
  const [selectingEndDate, setSelectingEndDate] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState("");

  const calculationRequestRef = useRef(0);

  const [form, setForm] = useState<PayrollForm>({
    employee_id: "",
    basic_salary: "0",
    semi_monthly_basic_salary: "0",
    pay_period: "",
    overtime: "0",

    present_days: "0",
    absent_days: "0",
    late_days: "0",
    attendance_deduction: "0",

    gross_salary: "0",
    sss: "0",
    philhealth: "0",
    pag_ibig: "0",
    deductions: "0",
    net_salary: "0",

    thirteenth_month_pay: "0",
    payroll_status: "Pending",
    payment_date: "",
  });

  /* =========================
     INITIAL LOAD
  ========================= */

  useEffect(() => {
    const now = new Date();

    setCurrentDate(
      now.toLocaleDateString("en-PH", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "Asia/Manila",
      })
    );

    setCalendarMonth(
      `${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, "0")}`
    );

    fetchPayroll();
    fetchEmployees();
  }, []);

  /* =========================
     AUTO-REFRESH PAYROLL CALCULATION
  ========================= */

  useEffect(() => {
    if (
      !showModal ||
      !form.employee_id ||
      !form.pay_period.trim()
    ) {
      return;
    }

    const runCalculation = () => {
      calculatePayroll(
        form.employee_id,
        form.pay_period,
        form.overtime,
        form.deductions
      );
    };

    runCalculation();

    const interval = setInterval(() => {
      runCalculation();
    }, 3000);

    return () => {
      clearInterval(interval);
    };
  }, [
    showModal,
    form.employee_id,
    form.pay_period,
    form.overtime,
    form.deductions,
  ]);

  /* =========================
     FETCH PAYROLL
  ========================= */

  const fetchPayroll = async () => {
    try {
      const response = await fetch(
        `${API}/payroll/?_=${Date.now()}`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch payroll");
      }

      const data = await response.json();

      setPayroll(data);
    } catch (error) {
      console.error("Error fetching payroll:", error);
    }
  };

  /* =========================
     FETCH EMPLOYEES
  ========================= */

  const fetchEmployees = async () => {
    try {
      const response = await fetch(
        `${API}/employees/?_=${Date.now()}`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch employees");
      }

      const data = await response.json();

      setEmployees(data);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  /* =========================
     PAY PERIOD HELPERS
  ========================= */

  const formatDateForInput = (date: Date) => {
    return `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  const formatSingleCalendarDate = (dateString: string) => {
    if (!dateString) {
      return "";
    }

    const date = new Date(`${dateString}T00:00:00`);

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatPayPeriod = (
    start: string,
    end: string
  ) => {
    if (!start || !end) {
      return "";
    }

    const startDate = new Date(`${start}T00:00:00`);
    const endDate = new Date(`${end}T00:00:00`);

    const monthFormatter = new Intl.DateTimeFormat(
      "en-US",
      {
        month: "long",
      }
    );

    const startMonth = monthFormatter.format(startDate);
    const endMonth = monthFormatter.format(endDate);

    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();

    if (
      startMonth === endMonth &&
      startYear === endYear
    ) {
      return `${startMonth} ${startDate.getDate()}-${endDate.getDate()}, ${startYear}`;
    }

    return `${startMonth} ${startDate.getDate()}, ${startYear} - ${endMonth} ${endDate.getDate()}, ${endYear}`;
  };

  const parseExistingPayPeriod = (
    period: string
  ) => {
    if (!period) {
      return null;
    }

    /*
     * Same month:
     * November 17-19, 2026
     */
    const sameMonthMatch = period.match(
      /^([A-Za-z]+)\s+(\d+)-(\d+),\s+(\d{4})$/
    );

    if (sameMonthMatch) {
      const monthName = sameMonthMatch[1];
      const startDay = Number(sameMonthMatch[2]);
      const endDay = Number(sameMonthMatch[3]);
      const year = Number(sameMonthMatch[4]);

      const monthIndex = new Date(
        `${monthName} 1, ${year}`
      ).getMonth();

      if (monthIndex >= 0) {
        const startDate = new Date(
          year,
          monthIndex,
          startDay
        );

        const endDate = new Date(
          year,
          monthIndex,
          endDay
        );

        return {
          start: formatDateForInput(startDate),
          end: formatDateForInput(endDate),
        };
      }
    }

    /*
     * Different months:
     * November 28, 2026 - December 3, 2026
     */
    const differentMonthMatch = period.match(
      /^([A-Za-z]+)\s+(\d+),\s+(\d{4})\s+-\s+([A-Za-z]+)\s+(\d+),\s+(\d{4})$/
    );

    if (differentMonthMatch) {
      const startMonth = differentMonthMatch[1];
      const startDay = Number(differentMonthMatch[2]);
      const startYear = Number(differentMonthMatch[3]);

      const endMonth = differentMonthMatch[4];
      const endDay = Number(differentMonthMatch[5]);
      const endYear = Number(differentMonthMatch[6]);

      const startMonthIndex = new Date(
        `${startMonth} 1, ${startYear}`
      ).getMonth();

      const endMonthIndex = new Date(
        `${endMonth} 1, ${endYear}`
      ).getMonth();

      if (
        startMonthIndex >= 0 &&
        endMonthIndex >= 0
      ) {
        return {
          start: formatDateForInput(
            new Date(
              startYear,
              startMonthIndex,
              startDay
            )
          ),
          end: formatDateForInput(
            new Date(
              endYear,
              endMonthIndex,
              endDay
            )
          ),
        };
      }
    }

    return null;
  };

  /* =========================
     CALENDAR HELPERS
  ========================= */

  const getCalendarDate = () => {
    if (!calendarMonth) {
      return new Date();
    }

    const [year, month] = calendarMonth
      .split("-")
      .map(Number);

    return new Date(year, month - 1, 1);
  };

  const getCalendarDays = () => {
    const date = getCalendarDate();

    const year = date.getFullYear();
    const month = date.getMonth();

    const firstDay = new Date(
      year,
      month,
      1
    ).getDay();

    const daysInMonth = new Date(
      year,
      month + 1,
      0
    ).getDate();

    const days: (string | null)[] = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    for (
      let day = 1;
      day <= daysInMonth;
      day++
    ) {
      days.push(
        formatDateForInput(
          new Date(
            year,
            month,
            day
          )
        )
      );
    }

    return days;
  };

  const changeCalendarMonth = (
    amount: number
  ) => {
    const date = getCalendarDate();

    date.setMonth(
      date.getMonth() + amount
    );

    setCalendarMonth(
      `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`
    );
  };

  const openPayPeriodCalendar = () => {
    if (form.pay_period) {
      const existing =
        parseExistingPayPeriod(
          form.pay_period
        );

      if (existing) {
        setPayPeriodStart(
          existing.start
        );

        setPayPeriodEnd(
          existing.end
        );

        setSelectingEndDate(false);

        setCalendarMonth(
          existing.start.substring(
            0,
            7
          )
        );
      }
    } else {
      const now = new Date();

      setPayPeriodStart("");
      setPayPeriodEnd("");
      setSelectingEndDate(false);

      setCalendarMonth(
        `${now.getFullYear()}-${String(
          now.getMonth() + 1
        ).padStart(2, "0")}`
      );
    }

    setShowPayPeriodCalendar(true);
  };

  const handlePayPeriodDateClick = (
    date: string
  ) => {
    /*
     * First click = start date
     */
    if (!selectingEndDate) {
      setPayPeriodStart(date);
      setPayPeriodEnd("");
      setSelectingEndDate(true);
      return;
    }

    /*
     * If second date is before
     * first date, restart selection.
     */
    if (date < payPeriodStart) {
      setPayPeriodStart(date);
      setPayPeriodEnd("");
      return;
    }

    /*
     * Second click = end date
     */
    setPayPeriodEnd(date);
    setSelectingEndDate(false);
  };

  const applyPayPeriod = () => {
    if (
      !payPeriodStart ||
      !payPeriodEnd
    ) {
      alert(
        "Please select a start date and end date."
      );
      return;
    }

    const formattedPeriod =
      formatPayPeriod(
        payPeriodStart,
        payPeriodEnd
      );

    setForm((prev) => ({
      ...prev,
      pay_period: formattedPeriod,
    }));

    setShowPayPeriodCalendar(false);

    if (form.employee_id) {
      calculatePayroll(
        form.employee_id,
        formattedPeriod,
        form.overtime,
        form.deductions
      );
    }
  };

  const cancelPayPeriodSelection = () => {
    setShowPayPeriodCalendar(false);
  };

  const isDateInSelectedRange = (
    date: string
  ) => {
    if (
      !payPeriodStart ||
      !payPeriodEnd
    ) {
      return false;
    }

    return (
      date >= payPeriodStart &&
      date <= payPeriodEnd
    );
  };

  const isSelectedStart = (
    date: string
  ) => {
    return date === payPeriodStart;
  };

  const isSelectedEnd = (
    date: string
  ) => {
    return date === payPeriodEnd;
  };

  const calendarTitle = () => {
    const date = getCalendarDate();

    return date.toLocaleDateString(
      "en-US",
      {
        month: "long",
        year: "numeric",
      }
    );
  };

  /* =========================
     RESET FORM
  ========================= */

  const resetForm = () => {
    setForm({
      employee_id: "",
      basic_salary: "0",
      semi_monthly_basic_salary: "0",
      pay_period: "",
      overtime: "0",

      present_days: "0",
      absent_days: "0",
      late_days: "0",
      attendance_deduction: "0",

      gross_salary: "0",
      sss: "0",
      philhealth: "0",
      pag_ibig: "0",
      deductions: "0",
      net_salary: "0",

      thirteenth_month_pay: "0",
      payroll_status: "Pending",
      payment_date: "",
    });

    setEmployeeSearch("");
    setShowEmployeeDropdown(false);
    setEditingId(null);

    setPayPeriodStart("");
    setPayPeriodEnd("");
    setSelectingEndDate(false);
    setShowPayPeriodCalendar(false);
  };

  /* =========================
     OPEN ADD MODAL
  ========================= */

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  /* =========================
     OPEN EDIT MODAL
  ========================= */

  const openEditModal = (
    record: Payroll
  ) => {
    setEditingId(
      record.payroll_id
    );

    setForm({
      employee_id:
        String(
          record.employee_id
        ),

      basic_salary:
        String(
          record.basic_salary ??
            0
        ),

      semi_monthly_basic_salary:
        String(
          record.period_basic_salary ??
            Number(
              record.basic_salary ??
                0
            ) / 2
        ),

      pay_period:
        record.pay_period ||
        "",

      overtime:
        String(
          record.overtime ??
            0
        ),

      present_days:
        String(
          record.present_days ??
            0
        ),

      absent_days:
        String(
          record.absent_days ??
            0
        ),

      late_days:
        String(
          record.late_days ??
            0
        ),

      attendance_deduction:
        String(
          record.attendance_deduction ??
            0
        ),

      gross_salary:
        String(
          record.gross_salary ??
            0
        ),

      sss:
        String(
          record.sss ??
            0
        ),

      philhealth:
        String(
          record.philhealth ??
            0
        ),

      pag_ibig:
        String(
          record.pag_ibig ??
            0
        ),

      deductions:
        String(
          record.deductions ??
            0
        ),

      net_salary:
        String(
          record.net_salary ??
            0
        ),

      thirteenth_month_pay:
        String(
          record[
            "13th_month_pay"
          ] ?? 0
        ),

      payroll_status:
        record.payroll_status ||
        "Pending",

      payment_date:
        record.payment_date
          ? record.payment_date.split(
              "T"
            )[0]
          : "",
    });

    const employee =
      employees.find(
        (emp) =>
          emp.employee_id ===
          record.employee_id
      );

    if (employee) {
      setEmployeeSearch(
        `${employee.first_name} ${employee.last_name}`
      );
    }

    const existingPeriod =
      parseExistingPayPeriod(
        record.pay_period ||
          ""
      );

    if (existingPeriod) {
      setPayPeriodStart(
        existingPeriod.start
      );

      setPayPeriodEnd(
        existingPeriod.end
      );

      setSelectingEndDate(
        false
      );

      setCalendarMonth(
        existingPeriod.start.substring(
          0,
          7
        )
      );
    } else {
      setPayPeriodStart("");
      setPayPeriodEnd("");
      setSelectingEndDate(false);
    }

    setShowEmployeeDropdown(false);
    setShowModal(true);
  };

  /* =========================
     CLOSE MODAL
  ========================= */

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  /* =========================
     HANDLE GENERAL INPUT
  ========================= */

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement
    >
  ) => {
    const {
      name,
      value,
    } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  /* =========================
     CALCULATE PAYROLL
  ========================= */

  const calculatePayroll =
    async (
      employeeId: string,
      payPeriod: string,
      overtime: string,
      deductions: string
    ) => {
      if (
        !employeeId ||
        !payPeriod.trim()
      ) {
        return;
      }

      const requestId =
        ++calculationRequestRef.current;

      try {
        const response =
          await fetch(
            `${API}/payroll/calculate?employee_id=${employeeId}&pay_period=${encodeURIComponent(
              payPeriod
            )}&overtime=${Number(
              overtime
            ) || 0}&deductions=${Number(
              deductions
            ) || 0}&_=${Date.now()}`,
            {
              cache:
                "no-store",
            }
          );

        if (!response.ok) {
          const errorData =
            await response.json();

          throw new Error(
            errorData.detail ||
              "Failed to calculate payroll"
          );
        }

        const data =
          await response.json();

        if (
          requestId !==
          calculationRequestRef.current
        ) {
          return;
        }

        setForm((prev) => ({
          ...prev,

          basic_salary:
            String(
              data.basic_salary ??
                0
            ),

          semi_monthly_basic_salary:
            String(
              data.period_basic_salary ??
                data.semi_monthly_salary ??
                0
            ),

          present_days:
            String(
              data.present_days ??
                0
            ),

          absent_days:
            String(
              data.absent_days ??
                0
            ),

          late_days:
            String(
              data.late_days ??
                0
            ),

          attendance_deduction:
            String(
              data.attendance_deduction ??
                0
            ),

          gross_salary:
            String(
              data.gross_salary ??
                0
            ),

          sss:
            String(
              data.sss ??
                0
            ),

          philhealth:
            String(
              data.philhealth ??
                0
            ),

          pag_ibig:
            String(
              data.pag_ibig ??
                0
            ),

          thirteenth_month_pay:
            String(
              data.thirteenth_month_pay ??
                0
            ),

          net_salary:
            String(
              Math.max(
                0,
                Number(
                  data.net_salary ??
                    0
                )
              )
            ),
        }));
      } catch (error) {
        console.error(
          "Payroll calculation error:",
          error
        );
      }
    };

  /* =========================
     OVERTIME
  ========================= */

  const handleOvertimeChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value =
      e.target.value;

    setForm((prev) => ({
      ...prev,
      overtime: value,
    }));

    if (
      form.employee_id &&
      form.pay_period.trim() !==
        ""
    ) {
      calculatePayroll(
        form.employee_id,
        form.pay_period,
        value,
        form.deductions
      );
    }
  };

  /* =========================
     OTHER DEDUCTIONS
  ========================= */

  const handleDeductionChange =
    (
      e: React.ChangeEvent<HTMLInputElement>
    ) => {
      const value =
        e.target.value;

      const gross =
        Number(
          form.gross_salary
        ) || 0;

      const sss =
        Number(
          form.sss
        ) || 0;

      const philhealth =
        Number(
          form.philhealth
        ) || 0;

      const pagibig =
        Number(
          form.pag_ibig
        ) || 0;

      const deductions =
        Number(
          value
        ) || 0;

      const netSalary =
        gross -
        sss -
        philhealth -
        pagibig -
        deductions;

      setForm((prev) => ({
        ...prev,
        deductions:
          value,
        net_salary:
          String(
            Math.max(
              0,
              netSalary
            )
          ),
      }));

      if (
        form.employee_id &&
        form.pay_period.trim() !==
          ""
      ) {
        calculatePayroll(
          form.employee_id,
          form.pay_period,
          form.overtime,
          value
        );
      }
    };

  /* =========================
     EMPLOYEE SEARCH
  ========================= */

  const handleEmployeeSearch =
    (
      e: React.ChangeEvent<HTMLInputElement>
    ) => {
      const value =
        e.target.value;

      setEmployeeSearch(
        value
      );

      setForm((prev) => ({
        ...prev,

        employee_id:
          "",

        basic_salary:
          "0",

        semi_monthly_basic_salary:
          "0",

        present_days:
          "0",

        absent_days:
          "0",

        late_days:
          "0",

        attendance_deduction:
          "0",

        gross_salary:
          "0",

        sss: "0",

        philhealth:
          "0",

        pag_ibig:
          "0",

        thirteenth_month_pay:
          "0",

        net_salary:
          "0",
      }));

      setShowEmployeeDropdown(
        true
      );
    };

  /* =========================
     SELECT EMPLOYEE
  ========================= */

  const selectEmployee = (
    employee: Employee
  ) => {
    const employeeName =
      `${employee.first_name} ${employee.last_name}`;

    const employeeId =
      String(
        employee.employee_id
      );

    setEmployeeSearch(
      employeeName
    );

    setForm((prev) => ({
      ...prev,
      employee_id:
        employeeId,
    }));

    setShowEmployeeDropdown(
      false
    );

    if (
      form.pay_period.trim() !==
      ""
    ) {
      calculatePayroll(
        employeeId,
        form.pay_period,
        form.overtime,
        form.deductions
      );
    }
  };

  /* =========================
     FILTER EMPLOYEES
  ========================= */

  const filteredEmployees =
    employees.filter(
      (employee) => {
        const fullName =
          `${employee.first_name} ${employee.last_name}`
            .toLowerCase();

        return fullName.includes(
          employeeSearch.toLowerCase()
        );
      }
    );

  /* =========================
     SUBMIT PAYROLL
  ========================= */

  const handleSubmit =
    async (
      e: React.FormEvent
    ) => {
      e.preventDefault();

      if (
        !form.employee_id
      ) {
        alert(
          "Please select an employee."
        );
        return;
      }

      if (
        !form.pay_period.trim()
      ) {
        alert(
          "Please select the pay period."
        );
        return;
      }

      const payload = {
        employee_id:
          Number(
            form.employee_id
          ),

        pay_period:
          form.pay_period,

        overtime:
          Number(
            form.overtime
          ) || 0,

        gross_salary:
          Number(
            form.gross_salary
          ) || 0,

        sss:
          Number(
            form.sss
          ) || 0,

        philhealth:
          Number(
            form.philhealth
          ) || 0,

        pag_ibig:
          Number(
            form.pag_ibig
          ) || 0,

        deductions:
          Number(
            form.deductions
          ) || 0,

        net_salary:
          Number(
            form.net_salary
          ) || 0,

        thirteenth_month_pay:
          Number(
            form.thirteenth_month_pay
          ) || 0,

        payroll_status:
          form.payroll_status,

        payment_date:
          form.payment_date ||
          null,
      };

      try {
        const url =
          editingId
            ? `${API}/payroll/${editingId}`
            : `${API}/payroll/`;

        const method =
          editingId
            ? "PUT"
            : "POST";

        const response =
          await fetch(
            url,
            {
              method,
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify(
                payload
              ),
            }
          );

        const data =
          await response.json();

        if (
          !response.ok
        ) {
          throw new Error(
            data.detail ||
              "Failed to save payroll"
          );
        }

        alert(
          editingId
            ? "Payroll updated successfully!"
            : "Payroll added successfully!"
        );

        closeModal();
        fetchPayroll();
      } catch (
        error
      ) {
        console.error(
          "Error saving payroll:",
          error
        );

        alert(
          error instanceof
            Error
            ? error.message
            : "Something went wrong."
        );
      }
    };

  /* =========================
     DELETE PAYROLL
  ========================= */

  const handleDelete =
    async (
      payrollId: number
    ) => {
      const confirmed =
        confirm(
          "Are you sure you want to delete this payroll record?"
        );

      if (!confirmed) {
        return;
      }

      try {
        const response =
          await fetch(
            `${API}/payroll/${payrollId}`,
            {
              method:
                "DELETE",
            }
          );

        const data =
          await response.json();

        if (
          !response.ok
        ) {
          throw new Error(
            data.detail ||
              "Failed to delete payroll"
          );
        }

        alert(
          "Payroll deleted successfully!"
        );

        fetchPayroll();
      } catch (
        error
      ) {
        console.error(
          "Delete error:",
          error
        );

        alert(
          error instanceof
            Error
            ? error.message
            : "Something went wrong."
        );
      }
    };

  /* =========================
     FILTER PAYROLL
  ========================= */

  const filteredPayroll =
    payroll.filter(
      (record) => {
        const searchValue =
          search.toLowerCase();

        const matchesSearch =
          record.employee_name
            ?.toLowerCase()
            .includes(
              searchValue
            ) ||
          record.pay_period
            ?.toLowerCase()
            .includes(
              searchValue
            );

        const matchesStatus =
          statusFilter ===
            "All" ||
          record.payroll_status ===
            statusFilter;

        return (
          matchesSearch &&
          matchesStatus
        );
      }
    );

  /* =========================
     STATISTICS
  ========================= */

  const totalPayroll =
    payroll.length;

  const pendingCount =
    payroll.filter(
      (record) =>
        record.payroll_status ===
        "Pending"
    ).length;

  const paidCount =
    payroll.filter(
      (record) =>
        record.payroll_status ===
        "Paid"
    ).length;

  /* =========================
     CURRENCY
  ========================= */

  const formatCurrency = (
    value: number
  ) => {
    return `₱${Number(
      value || 0
    ).toLocaleString(
      "en-PH",
      {
        minimumFractionDigits:
          2,
        maximumFractionDigits:
          2,
      }
    )}`;
  };

  /* =========================
     PAYMENT DATE
  ========================= */

  const formatPaymentDate =
    (
      value: string | null
    ) => {
      if (!value) {
        return "-";
      }

      const datePart =
        value.split(
          "T"
        )[0];

      const parts =
        datePart.split(
          "-"
        );

      if (
        parts.length !==
        3
      ) {
        return value;
      }

      return `${parts[1]}/${parts[2]}/${parts[0]}`;
    };

  return (
    <div className="payroll-page">

      {/* SHARED HRIS SIDEBAR */}
      <HRISSidebar />

      {/* MAIN */}
      <main className="main-content">

        <div className="page-header">

          <div>

            <h1>
              Payroll Management
            </h1>

            <p>
              Manage employee payroll,
              deductions, and salary
              payments.
            </p>

          </div>

          <div className="current-date">
            {currentDate}
          </div>

        </div>

        {/* STATS */}
        <div className="stats-grid">

          <div className="stat-card">

            <div>
              <p>
                Total Payroll
              </p>

              <h2>
                {totalPayroll}
              </h2>
            </div>

            <div className="stat-icon">
              💰
            </div>

          </div>

          <div className="stat-card">

            <div>
              <p>
                Pending
              </p>

              <h2>
                {pendingCount}
              </h2>
            </div>

            <div className="stat-icon">
              ⏳
            </div>

          </div>

          <div className="stat-card">

            <div>
              <p>
                Paid
              </p>

              <h2>
                {paidCount}
              </h2>
            </div>

            <div className="stat-icon">
              💵
            </div>

          </div>

        </div>

        {/* RECORDS */}
        <div className="record-card">

          <div className="record-header">

            <div>

              <h2>
                Payroll Records
              </h2>

              <p>
                View and manage employee
                payroll records.
              </p>

            </div>

            <button
              className="add-button"
              onClick={
                openAddModal
              }
            >
              + Add Payroll
            </button>

          </div>

          {/* FILTERS */}
          <div className="filters">

            <div className="search-box">

              <span>
                🔍
              </span>

              <input
                type="text"
                placeholder="Search employee or pay period..."
                value={
                  search
                }
                onChange={(
                  e
                ) =>
                  setSearch(
                    e.target.value
                  )
                }
              />

            </div>

            <select
              value={
                statusFilter
              }
              onChange={(
                e
              ) =>
                setStatusFilter(
                  e.target.value
                )
              }
            >

              <option value="All">
                All Status
              </option>

              <option value="Pending">
                Pending
              </option>

              <option value="Paid">
                Paid
              </option>

            </select>

          </div>

          {/* TABLE */}
          <div className="table-container">

            <table>

              <thead>

                <tr>

                  <th>
                    EMPLOYEE
                  </th>

                  <th>
                    MONTHLY BASIC
                  </th>

                  <th>
                    PAY PERIOD
                  </th>

                  <th>
                    OVERTIME
                  </th>

                  <th>
                    GROSS SALARY
                  </th>

                  <th>
                    DEDUCTIONS
                  </th>

                  <th>
                    NET SALARY
                  </th>

                  <th>
                    STATUS
                  </th>

                  <th>
                    PAYMENT DATE
                  </th>

                  <th>
                    ACTIONS
                  </th>

                </tr>

              </thead>

              <tbody>

                {filteredPayroll.length ===
                0 ? (

                  <tr>

                    <td
                      colSpan={
                        10
                      }
                      className="empty-state"
                    >
                      No payroll records
                      found.
                    </td>

                  </tr>

                ) : (

                  filteredPayroll.map(
                    (
                      record
                    ) => (

                      <tr
                        key={
                          record.payroll_id
                        }
                      >

                        <td>

                          <div className="employee-cell">

                            <div className="employee-avatar">

                              {record.employee_name
                                ?.charAt(
                                  0
                                )
                                .toUpperCase()}

                            </div>

                            <div>

                              <strong>
                                {
                                  record.employee_name
                                }
                              </strong>

                              <span>
                                Employee #
                                {
                                  record.employee_id
                                }
                              </span>

                            </div>

                          </div>

                        </td>

                        <td>
                          {formatCurrency(
                            record.basic_salary
                          )}
                        </td>

                        <td>
                          {
                            record.pay_period
                          }
                        </td>

                        <td>
                          {formatCurrency(
                            record.overtime
                          )}
                        </td>

                        <td>
                          {formatCurrency(
                            record.gross_salary
                          )}
                        </td>

                        <td>
                          {formatCurrency(
                            Number(
                              record.sss ||
                                0
                            ) +
                              Number(
                                record.philhealth ||
                                  0
                              ) +
                              Number(
                                record.pag_ibig ||
                                  0
                              ) +
                              Number(
                                record.deductions ||
                                  0
                              )
                          )}
                        </td>

                        <td>

                          <strong>
                            {formatCurrency(
                              record.net_salary
                            )}
                          </strong>

                        </td>

                        <td>

                          <span
                            className={`status-badge ${record.payroll_status
                              ?.toLowerCase()
                              .replace(
                                " ",
                                "-"
                              )}`}
                          >
                            {
                              record.payroll_status
                            }
                          </span>

                        </td>

                        <td>

                          {formatPaymentDate(
                            record.payment_date
                          )}

                        </td>

                        <td>

                          <div className="action-buttons">

                            <button
                              className="edit-button"
                              onClick={() =>
                                openEditModal(
                                  record
                                )
                              }
                            >
                              Edit
                            </button>

                            <button
                              className="delete-button"
                              onClick={() =>
                                handleDelete(
                                  record.payroll_id
                                )
                              }
                            >
                              Delete
                            </button>

                          </div>

                        </td>

                      </tr>

                    )
                  )

                )}

              </tbody>

            </table>

          </div>

        </div>

      </main>

      {/* MODAL */}
      {showModal && (

        <div className="modal-overlay">

          <div className="modal">

            <div className="modal-header">

              <div>

                <h2>
                  {editingId
                    ? "Edit Payroll"
                    : "Add Payroll"}
                </h2>

                <p>
                  Salary and attendance
                  deductions are
                  automatically calculated.
                </p>

              </div>

              <button
                className="close-button"
                onClick={
                  closeModal
                }
              >
                ×
              </button>

            </div>

            <form
              onSubmit={
                handleSubmit
              }
            >

              <div className="form-grid">

                {/* EMPLOYEE */}
                <div className="form-group employee-search-group">

                  <label>
                    Employee
                  </label>

                  <div className="employee-search-wrapper">

                    <input
                      type="text"
                      placeholder="Search employee..."
                      value={
                        employeeSearch
                      }
                      onChange={
                        handleEmployeeSearch
                      }
                      onFocus={() =>
                        setShowEmployeeDropdown(
                          true
                        )
                      }
                      required
                    />

                    {showEmployeeDropdown &&
                      employeeSearch && (

                        <div className="employee-dropdown">

                          {filteredEmployees.length ===
                          0 ? (

                            <div className="no-results">
                              No employee
                              found
                            </div>

                          ) : (

                            filteredEmployees.map(
                              (
                                employee
                              ) => (

                                <div
                                  key={
                                    employee.employee_id
                                  }
                                  className="employee-option"
                                  onClick={() =>
                                    selectEmployee(
                                      employee
                                    )
                                  }
                                >

                                  <strong>
                                    {
                                      employee.first_name
                                    }{" "}
                                    {
                                      employee.last_name
                                    }
                                  </strong>

                                  <span>
                                    Employee #
                                    {
                                      employee.employee_id
                                    }
                                  </span>

                                </div>

                              )
                            )

                          )}

                        </div>

                      )}

                  </div>

                  {!form.employee_id && (
                    <small className="calculation-note">
                      Select an employee
                      to load their
                      salary.
                    </small>
                  )}

                </div>

                {/* MONTHLY BASIC SALARY */}
                <div className="form-group">

                  <label>
                    Monthly Basic Salary
                  </label>

                  <div className="calculated-field">

                    ₱
                    {Number(
                      form.basic_salary ||
                        0
                    ).toLocaleString(
                      "en-PH",
                      {
                        minimumFractionDigits:
                          2,
                        maximumFractionDigits:
                          2,
                      }
                    )}

                  </div>

                  <small className="calculation-note">
                    From employee's
                    position
                  </small>

                </div>

                {/* PERIOD BASIC SALARY */}
                <div className="form-group">

                  <label>
                    Selected Period Basic Salary
                  </label>

                  <div className="calculated-field">

                    ₱
                    {Number(
                      form.semi_monthly_basic_salary ||
                        0
                    ).toLocaleString(
                      "en-PH",
                      {
                        minimumFractionDigits:
                          2,
                        maximumFractionDigits:
                          2,
                      }
                    )}

                  </div>

                  <small className="calculation-note">
                    Based on the selected
                    pay period.
                  </small>

                </div>

                {/* PAY PERIOD */}
                <div className="form-group pay-period-form-group">

                  <label>
                    Pay Period
                  </label>

                  <div className="pay-period-picker">

                    <button
                      type="button"
                      className="pay-period-display"
                      onClick={
                        openPayPeriodCalendar
                      }
                    >
                      <span className="calendar-icon">
                        📅
                      </span>

                      <span>
                        {form.pay_period ||
                          "Select pay period"}
                      </span>
                    </button>

                    {showPayPeriodCalendar && (

                      <div className="pay-period-calendar">

                        <div className="calendar-header">

                          <button
                            type="button"
                            className="calendar-nav-button"
                            onClick={() =>
                              changeCalendarMonth(
                                -1
                              )
                            }
                          >
                            ‹
                          </button>

                          <strong>
                            {calendarTitle()}
                          </strong>

                          <button
                            type="button"
                            className="calendar-nav-button"
                            onClick={() =>
                              changeCalendarMonth(
                                1
                              )
                            }
                          >
                            ›
                          </button>

                        </div>

                        <div className="calendar-selection-info">

                          {!payPeriodStart && (
                            <span>
                              Select start date
                            </span>
                          )}

                          {payPeriodStart &&
                            !payPeriodEnd && (
                              <span>
                                Start:{" "}
                                {formatSingleCalendarDate(
                                  payPeriodStart
                                )}
                                {" — "}
                                Select end date
                              </span>
                            )}

                          {payPeriodStart &&
                            payPeriodEnd && (
                              <span>
                                {formatPayPeriod(
                                  payPeriodStart,
                                  payPeriodEnd
                                )}
                              </span>
                            )}

                        </div>

                        <div className="calendar-weekdays">

                          <span>
                            Sun
                          </span>

                          <span>
                            Mon
                          </span>

                          <span>
                            Tue
                          </span>

                          <span>
                            Wed
                          </span>

                          <span>
                            Thu
                          </span>

                          <span>
                            Fri
                          </span>

                          <span>
                            Sat
                          </span>

                        </div>

                        <div className="calendar-days">

                          {getCalendarDays().map(
                            (
                              date,
                              index
                            ) => {

                              if (!date) {
                                return (
                                  <div
                                    key={
                                      `empty-${index}`
                                    }
                                    className="calendar-day empty"
                                  />
                                );
                              }

                              const inRange =
                                isDateInSelectedRange(
                                  date
                                );

                              const start =
                                isSelectedStart(
                                  date
                                );

                              const end =
                                isSelectedEnd(
                                  date
                                );

                              return (
                                <button
                                  type="button"
                                  key={
                                    date
                                  }
                                  className={`calendar-day ${
                                    inRange
                                      ? "in-range"
                                      : ""
                                  } ${
                                    start
                                      ? "range-start"
                                      : ""
                                  } ${
                                    end
                                      ? "range-end"
                                      : ""
                                  }`}
                                  onClick={() =>
                                    handlePayPeriodDateClick(
                                      date
                                    )
                                  }
                                >
                                  {Number(
                                    date.substring(
                                      8,
                                      10
                                    )
                                  )}
                                </button>
                              );
                            }
                          )}

                        </div>

                        <div className="calendar-actions">

                          <button
                            type="button"
                            className="calendar-cancel-button"
                            onClick={
                              cancelPayPeriodSelection
                            }
                          >
                            Cancel
                          </button>

                          <button
                            type="button"
                            className="calendar-apply-button"
                            onClick={
                              applyPayPeriod
                            }
                            disabled={
                              !payPeriodStart ||
                              !payPeriodEnd
                            }
                          >
                            Apply
                          </button>

                        </div>

                      </div>

                    )}

                  </div>

                  <small className="calculation-note">
                    Select a start date and
                    end date. Attendance and
                    salary are calculated only
                    within this period.
                  </small>

                </div>

                {/* ATTENDANCE */}
                <div className="attendance-section">

                  <div className="attendance-section-title">

                    <h3>
                      Attendance
                    </h3>

                    <span>
                      Based on selected
                      pay period
                    </span>

                  </div>

                  <div className="attendance-grid">

                    <div className="attendance-item">

                      <span>
                        Present Days:
                      </span>

                      <strong>
                        {
                          form.present_days
                        }
                      </strong>

                    </div>

                    <div className="attendance-item">

                      <span>
                        Absent Days:
                      </span>

                      <strong>
                        {
                          form.absent_days
                        }
                      </strong>

                    </div>

                    <div className="attendance-item">

                      <span>
                        Late Days:
                      </span>

                      <strong>
                        {
                          form.late_days
                        }
                      </strong>

                    </div>

                    <div className="attendance-item deduction">

                      <span>
                        Attendance Deduction:
                      </span>

                      <strong>
                        {formatCurrency(
                          Number(
                            form.attendance_deduction ||
                              0
                          )
                        )}
                      </strong>

                    </div>

                  </div>

                </div>

                {/* OVERTIME */}
                <div className="form-group">

                  <label>
                    Overtime
                  </label>

                  <input
                    type="number"
                    name="overtime"
                    min="0"
                    step="0.01"
                    value={
                      form.overtime
                    }
                    onChange={
                      handleOvertimeChange
                    }
                  />

                  <small className="calculation-note">
                    Enter overtime
                    amount. Overtime is
                    added to gross and
                    net salary.
                  </small>

                </div>

                {/* GROSS SALARY */}
                <div className="form-group">

                  <label>
                    Gross Salary
                  </label>

                  <div className="calculated-field">

                    ₱
                    {Number(
                      form.gross_salary ||
                        0
                    ).toLocaleString(
                      "en-PH",
                      {
                        minimumFractionDigits:
                          2,
                        maximumFractionDigits:
                          2,
                      }
                    )}

                  </div>

                  <small className="calculation-note">
                    Period basic + overtime
                    − attendance deduction
                  </small>

                </div>

                {/* SSS */}
                <div className="form-group">

                  <label>
                    SSS
                  </label>

                  <div className="calculated-field">

                    ₱
                    {Number(
                      form.sss ||
                        0
                    ).toLocaleString(
                      "en-PH",
                      {
                        minimumFractionDigits:
                          2,
                        maximumFractionDigits:
                          2,
                      }
                    )}

                  </div>

                  <small className="calculation-note">
                    Automatically
                    calculated
                  </small>

                </div>

                {/* PHILHEALTH */}
                <div className="form-group">

                  <label>
                    PhilHealth
                  </label>

                  <div className="calculated-field">

                    ₱
                    {Number(
                      form.philhealth ||
                        0
                    ).toLocaleString(
                      "en-PH",
                      {
                        minimumFractionDigits:
                          2,
                        maximumFractionDigits:
                          2,
                      }
                    )}

                  </div>

                  <small className="calculation-note">
                    Automatically
                    calculated
                  </small>

                </div>

                {/* PAG-IBIG */}
                <div className="form-group">

                  <label>
                    Pag-IBIG
                  </label>

                  <div className="calculated-field">

                    ₱
                    {Number(
                      form.pag_ibig ||
                        0
                    ).toLocaleString(
                      "en-PH",
                      {
                        minimumFractionDigits:
                          2,
                        maximumFractionDigits:
                          2,
                      }
                    )}

                  </div>

                  <small className="calculation-note">
                    Automatically
                    calculated
                  </small>

                </div>

                {/* OTHER DEDUCTIONS */}
                <div className="form-group">

                  <label>
                    Other Deductions
                  </label>

                  <input
                    type="number"
                    name="deductions"
                    min="0"
                    step="0.01"
                    value={
                      form.deductions
                    }
                    onChange={
                      handleDeductionChange
                    }
                  />

                  <small className="calculation-note">
                    Additional employee
                    deductions.
                  </small>

                </div>

                {/* NET SALARY */}
                <div className="form-group">

                  <label>
                    Net Salary
                  </label>

                  <div className="calculated-field net-salary-field">

                    ₱
                    {Number(
                      form.net_salary ||
                        0
                    ).toLocaleString(
                      "en-PH",
                      {
                        minimumFractionDigits:
                          2,
                        maximumFractionDigits:
                          2,
                      }
                    )}

                  </div>

                  <small className="calculation-note">
                    Gross salary − SSS −
                    PhilHealth − Pag-IBIG
                    − other deductions.
                  </small>

                </div>

                {/* 13TH MONTH PAY */}
                <div className="form-group">

                  <label>
                    13th Month Pay
                  </label>

                  <div className="calculated-field net-salary-field">

                    ₱
                    {Number(
                      form.thirteenth_month_pay ||
                        0
                    ).toLocaleString(
                      "en-PH",
                      {
                        minimumFractionDigits:
                          2,
                        maximumFractionDigits:
                          2,
                      }
                    )}

                  </div>

                  <small className="calculation-note">
                    Selected period basic
                    salary ÷ 12
                  </small>

                </div>

                {/* STATUS */}
                <div className="form-group">

                  <label>
                    Payroll Status
                  </label>

                  <select
                    name="payroll_status"
                    value={
                      form.payroll_status
                    }
                    onChange={
                      handleChange
                    }
                  >

                    <option value="Pending">
                      Pending
                    </option>

                    <option value="Paid">
                      Paid
                    </option>

                  </select>

                </div>

                {/* PAYMENT DATE */}
                <div className="form-group">

                  <label>
                    Payment Date
                  </label>

                  <input
                    type="date"
                    name="payment_date"
                    value={
                      form.payment_date
                    }
                    onChange={
                      handleChange
                    }
                  />

                </div>

              </div>

              <div className="modal-actions">

                <button
                  type="button"
                  className="cancel-button"
                  onClick={
                    closeModal
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="save-button"
                >
                  {editingId
                    ? "Update Payroll"
                    : "Save Payroll"}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}