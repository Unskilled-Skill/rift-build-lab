use rbl_core::deeplink::{OpenBuild, SCHEME, find_in_args, parse};

#[test]
fn opens_a_build_by_champion_and_plan_only() {
    assert_eq!(SCHEME, "riftbuildlab-desktop");
    assert_eq!(
        parse("riftbuildlab-desktop://open?champion=Ahri&plan=meta:Ahri:mid:opgg"),
        Some(OpenBuild { champion: "Ahri".into(), plan_id: Some("meta:Ahri:mid:opgg".into()) })
    );
    assert_eq!(parse("riftbuildlab-desktop://open/?champion=Cassiopeia"), Some(OpenBuild { champion: "Cassiopeia".into(), plan_id: None }));
    assert_eq!(
        parse("RIFTBUILDLAB-DESKTOP://open?plan=authored:Ahri:x&champion=Ahri").unwrap().plan_id.as_deref(),
        Some("authored:Ahri:x")
    );
}

#[test]
fn rejects_anything_that_could_apply_import_or_address_files() {
    for url in [
        "riftbuildlab://import?data=eyJ9",
        "riftbuildlab-desktop://apply?champion=Ahri",
        "riftbuildlab-desktop://open?champion=Ahri&autoImport=true",
        "riftbuildlab-desktop://open?champion=Ahri&champion=Zed",
        "riftbuildlab-desktop://open?champion=../Ahri",
        "riftbuildlab-desktop://open?champion=Ahri%2F..",
        "riftbuildlab-desktop://open?champion=",
        "riftbuildlab-desktop://open?plan=meta:Ahri:mid:opgg",
        "riftbuildlab-desktop://open?champion=Ahri&plan=meta Ahri",
        "riftbuildlab-desktop://open?champion=Ahri#x",
        "riftbuildlab-desktop://open/extra?champion=Ahri",
        "riftbuildlab-desktop://open@evil?champion=Ahri",
        "https://open?champion=Ahri",
        "",
    ] {
        assert_eq!(parse(url), None, "{url}");
    }
    let long = format!("riftbuildlab-desktop://open?champion=Ahri&plan=meta:{}", "a".repeat(400));
    assert_eq!(parse(&long), None);
}

#[test]
fn finds_the_link_among_launch_arguments() {
    let args = ["C:\\Program Files\\Rift Build Lab\\rift-build-lab.exe", "--background", "riftbuildlab-desktop://open?champion=Ahri"]
        .map(String::from);
    assert_eq!(find_in_args(&args).unwrap().champion, "Ahri");
    assert_eq!(find_in_args(&["app.exe".to_string(), "--background".to_string()]), None);
    assert_eq!(find_in_args(&["app.exe".to_string(), "riftbuildlab-desktop://open?champion=../x".to_string()]), None);
}
